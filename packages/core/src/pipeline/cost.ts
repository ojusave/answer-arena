import type {
  CostController,
  CostOperationKind,
  WithReceipt,
} from "../ports.js";

export async function runCostedOperation<T extends WithReceipt<unknown>>(args: {
  controller?: CostController;
  operationKey: string;
  kind: CostOperationKind;
  call: (maxCostUsd?: number) => Promise<T>;
}): Promise<T> {
  if (!args.controller) return args.call();

  const reservation = await args.controller.reserve(args.operationKey, args.kind);
  if (reservation.replayAvailable) {
    return reservation.replayResult as T;
  }

  let result: T;
  try {
    result = await args.call(reservation.maxCostUsd);
  } catch (error) {
    // A failed call leaves nothing to replay whether or not it was billed, so
    // the reservation goes back and the caller is free to retry. Charging an
    // ambiguous call the full per-call ceiling instead cost far more than the
    // unrecorded spend it hedged against: four lost responses billed $2.00
    // against real spend of under three cents, and exhausted the run's budget.
    await args.controller.release(args.operationKey);
    throw error;
  }

  const settledResult = result.receipt.costUnknown
    ? ({
        ...result,
        receipt: {
          ...result.receipt,
          costUsd: reservation.maxCostUsd,
        },
      } as T)
    : result;
  await args.controller.settle(
    args.operationKey,
    settledResult.receipt.costUsd,
    settledResult
  );
  return settledResult;
}

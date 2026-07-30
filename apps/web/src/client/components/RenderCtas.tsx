import { Button, Group } from "@mantine/core";
import { DEPLOY_TO_RENDER_URL, renderSignupUrlWithUtms, EXTERNAL_LINK_PROPS } from "../lib/render-links";

type Props = {
  signupContent?: "navbar_button" | "hero_cta" | "footer_link";
  size?: "compact-sm" | "sm" | "md";
};

/** Single placement for Deploy + Sign up on Render links. */
export default function RenderCtas({ signupContent = "navbar_button", size = "compact-sm" }: Props) {
  return (
    <Group gap="xs" wrap="nowrap" className="render-ctas">
      <Button
        className="render-deploy"
        component="a"
        href={DEPLOY_TO_RENDER_URL}
        {...EXTERNAL_LINK_PROPS}
        variant="filled"
        size={size}
      >
        <span className="render-cta-full">Deploy to Render</span>
        <span className="render-cta-short">Deploy</span>
      </Button>
      <Button
        className="render-signup"
        component="a"
        href={renderSignupUrlWithUtms(signupContent)}
        {...EXTERNAL_LINK_PROPS}
        variant="outline"
        size={size}
      >
        <span className="render-cta-full">Sign up on Render</span>
        <span className="render-cta-short">Sign up</span>
      </Button>
    </Group>
  );
}

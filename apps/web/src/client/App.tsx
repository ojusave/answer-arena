import { Anchor, AppShell, Box, Group, Text, UnstyledButton } from "@mantine/core";
import { useState } from "react";
import { Route, Routes, Link } from "react-router-dom";
import { GITHUB_REPO_URL, WORKFLOWS_DOCS_URL } from "./lib/render-links";
import RenderCtas from "./components/RenderCtas";
import ThemeToggle from "./components/ThemeToggle";
import HowItWorksModal from "./components/workspace/HowItWorksModal";
import WorkspacePage from "./pages/WorkspacePage";
import NotFoundPage from "./pages/NotFoundPage";
import { COPY } from "./lib/copy";

export default function App() {
  const [showHow, setShowHow] = useState(false);

  return (
    <AppShell
      header={{ height: { base: 48, sm: 66 } }}
      footer={{ height: 48 }}
      padding={0}
      className="pg-shell"
    >
      <AppShell.Header className="pg-header">
        <Group h="100%" justify="space-between" wrap="nowrap" className="pg-nav">
          <Anchor component={Link} to="/" className="pg-brand">
            <img src="/favicon.svg" alt="" width="24" height="24" className="pg-brand-mark" />
            <Box className="pg-brand-copy">
              <Text className="pg-brand-name">Answer Arena</Text>
            </Box>
            <span className="pg-brand-rule" aria-hidden="true" />
            <Text className="pg-brand-subtitle">{COPY.app.subtitle}</Text>
          </Anchor>

          <Group gap="xs" wrap="nowrap" className="rag-utility-nav">
            <UnstyledButton className="pg-footer-link" onClick={() => setShowHow(true)}>
              {COPY.app.howItWorks}
            </UnstyledButton>
            <ThemeToggle />
            <span className="rag-nav-divider" aria-hidden="true" />
            <RenderCtas />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Main className="pg-main">
        <Routes>
          <Route path="/" element={<WorkspacePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell.Main>

      <AppShell.Footer className="pg-footer">
        <Group justify="center" wrap="wrap" className="pg-footer-inner">
          <Group gap="lg" justify="center">
            <Anchor
              className="pg-footer-link"
              href={GITHUB_REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              {COPY.app.githubLink}
            </Anchor>
            <Anchor
              className="pg-footer-link"
              href={WORKFLOWS_DOCS_URL}
              target="_blank"
              rel="noreferrer"
            >
              {COPY.app.workflowsDocs}
            </Anchor>
          </Group>
        </Group>
      </AppShell.Footer>

      <HowItWorksModal opened={showHow} onClose={() => setShowHow(false)} />
    </AppShell>
  );
}

import { createFileRoute, Outlet } from "@tanstack/react-router";

// Open access: the app has no sign-in. This layout only renders its children.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: () => <Outlet />,
});

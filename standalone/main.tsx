import { createRoot } from "react-dom/client";
import Page from "@/app/page";

// Same component tree the Next app renders. lib/client falls back to the
// in-browser rules driver when /api/agent isn't there, so this needs no server.
createRoot(document.getElementById("root")!).render(<Page />);

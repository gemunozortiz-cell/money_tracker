/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useEffect, useState, ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders its children into a fresh <div> appended to <body>.
 *
 * Why: a `position: fixed` overlay (modal / bottom-sheet) that lives inside an
 * ancestor with `transform`, `filter` or `backdrop-filter` (e.g. our
 * `backdrop-blur` section cards) is positioned relative to THAT ancestor, not
 * the viewport. On mobile this makes modals appear mid-page so the user has to
 * scroll to find them. Portaling to <body> escapes that containing block so
 * `fixed inset-0` always covers the real screen.
 */
export function Portal({ children }: { children: ReactNode }) {
  const [el] = useState(() => document.createElement("div"));
  useEffect(() => {
    document.body.appendChild(el);
    return () => {
      document.body.removeChild(el);
    };
  }, [el]);
  return createPortal(children, el);
}

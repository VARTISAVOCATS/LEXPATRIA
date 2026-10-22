import type { AnchorHTMLAttributes } from "react";
import { naviguer } from "../navigation";

export default function Link({ href, children, ...r }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) {
  return (
    <a
      {...r}
      href={href}
      onClick={(e) => {
        e.preventDefault();
        naviguer(href);
      }}
    >
      {children}
    </a>
  );
}

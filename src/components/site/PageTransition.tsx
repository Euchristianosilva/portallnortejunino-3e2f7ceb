import { useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, type ReactNode } from "react";

export function PageTransition({ children, panel = false }: { children: ReactNode; panel?: boolean }) {
  const pathname = useRouterState({ select: (s) => (s.resolvedLocation ?? s.location).pathname });
  const path = !panel && pathname.startsWith("/painel") ? "/painel" : pathname;
  return <MotionScope key={path} scope={panel ? "panel" : path === "/painel" ? "shell" : "public"}>{children}</MotionScope>;
}

function MotionScope({ children, scope }: { children: ReactNode; scope: "public" | "panel" | "shell" }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root || scope === "shell" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const seen = new WeakSet<Element>();
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add("portal-item-enter");
        observer.unobserve(entry.target);
      }
    }, { threshold: 0.08 });
    const register = () => {
      root.querySelectorAll('[data-motion="item"], article, button.shadow-card, [data-motion="state"]').forEach((element) => {
        if (seen.has(element) || element.parentElement?.closest('[data-motion="item"], article, button.shadow-card, [data-motion="state"]')) return;
        seen.add(element);
        observer.observe(element);
      });
    };
    register();
    const mutations = new MutationObserver(register);
    mutations.observe(root, { childList: true, subtree: true });
    return () => { mutations.disconnect(); observer.disconnect(); };
  }, [scope]);
  return <div ref={ref} className="portal-page-transition" data-motion-scope={scope}>{children}</div>;
}
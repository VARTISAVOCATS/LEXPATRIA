import { cheminCourant, naviguer, useChemin } from "../navigation";

export function useRouter() {
  return { push: naviguer, replace: naviguer, refresh: () => window.dispatchEvent(new Event("demo:langue")), back: () => { try { history.back(); } catch { /* */ } } };
}
export function usePathname() {
  return useChemin().split("?")[0];
}
export { cheminCourant };

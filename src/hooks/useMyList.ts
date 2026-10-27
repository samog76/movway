import { useSyncExternalStore } from "react";
import { getMyList, subscribeMyList } from "@/lib/myList";

/** The saved list, re-rendering wherever it is shown when it changes. */
export function useMyList() {
  return useSyncExternalStore(subscribeMyList, getMyList, getMyList);
}

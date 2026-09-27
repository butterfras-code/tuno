/** Dispose a mounted element after removal. Moving it within the document is safe. */
export function onUnmount(node: HTMLElement, dispose: () => void) {
  let mounted = node.isConnected;
  const observer = new MutationObserver(records => {
    if (node.isConnected) mounted = true;
    // Removal records retain evidence of a mount even when insertion and removal
    // happen in the same task, before the observer sees a connected node.
    else if (mounted || records.some(record => [...record.removedNodes].some(removed => removed.contains(node)))) { observer.disconnect(); dispose(); }
  });
  observer.observe(document, { childList: true, subtree: true });
  return () => observer.disconnect();
}

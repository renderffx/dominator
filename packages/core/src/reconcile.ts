export interface ReconcileItem {
  key: string | number;
  nodes: Node[];
}

export const reconcile = (
  anchor: Comment,
  oldItems: ReconcileItem[],
  newData: any[],
  keyFn: (item: any) => string | number,
  renderFn: (item: any) => Node[]
): ReconcileItem[] => {
  const oldMap = new Map<string | number, ReconcileItem>();
  for (const item of oldItems) {
    oldMap.set(item.key, item);
  }

  const newItems: ReconcileItem[] = [];
  const parent = anchor.parentNode!;
  let nextSibling = anchor.nextSibling;

  for (let i = 0; i < newData.length; i++) {
    const key = keyFn(newData[i]);
    const existing = oldMap.get(key);

    if (existing) {
      oldMap.delete(key);
      newItems.push(existing);
    } else {
      const nodes = renderFn(newData[i]);
      newItems.push({ key, nodes });
    }
  }

  for (const [, removed] of oldMap) {
    for (const node of removed.nodes) {
      node.parentNode?.removeChild(node);
    }
  }

  let insertBefore = nextSibling;
  for (const item of newItems) {
    for (const node of item.nodes) {
      if (node.parentNode !== parent || node.nextSibling !== insertBefore) {
        parent.insertBefore(node, insertBefore);
      }
    }
    if (item.nodes.length > 0) {
      insertBefore = item.nodes[item.nodes.length - 1].nextSibling;
    }
  }

  return newItems;
};

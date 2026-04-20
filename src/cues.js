export function flattenCues(cues, depth = 0, parentId = "") {
  return cues.flatMap((cue, index) => {
    const current = {
      uniqueID: cue.uniqueID || "",
      number: cue.number || "",
      name: cue.name || "",
      listName: cue.listName || "",
      type: cue.type || "",
      colorName: cue.colorName || "none",
      flagged: Number(cue.flagged || 0),
      armed: Number(cue.armed ?? 1),
      depth,
      parentId,
      groupName: cue.listName || "",
      order: index
    };
    const children = Array.isArray(cue.cues) ? flattenCues(cue.cues, depth + 1, current.uniqueID) : [];
    for (const child of children) {
      if (!child.groupName) child.groupName = current.name || current.number || "";
    }
    return [current, ...children];
  });
}

export function asArray(value) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  return [value];
}

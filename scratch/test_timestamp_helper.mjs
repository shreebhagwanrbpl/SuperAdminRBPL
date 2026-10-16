function createTimestamp(val) {
  if (!val) return val;
  if (typeof val === "object" && typeof val.toDate === "function") return val;
  if (typeof val === "object" && typeof val.seconds === "number") {
    const d = new Date(val.seconds * 1000 + (val.nanoseconds ? Math.floor(val.nanoseconds / 1000000) : 0));
    return {
      toDate: () => d,
      toMillis: () => d.getTime(),
      toISOString: () => d.toISOString(),
      toString: () => d.toLocaleString("en-IN"),
      toLocaleString: (...args) => d.toLocaleString(...(args.length ? args : ["en-IN"])),
      toLocaleDateString: (...args) => d.toLocaleDateString(...(args.length ? args : ["en-IN"])),
      toLocaleTimeString: (...args) => d.toLocaleTimeString(...(args.length ? args : ["en-IN"])),
      seconds: val.seconds,
      nanoseconds: val.nanoseconds || 0,
      toJSON: () => d.toISOString(),
    };
  }
  const d = val instanceof Date ? val : new Date(val);
  if (isNaN(d.getTime())) return val;
  return {
    toDate: () => d,
    toMillis: () => d.getTime(),
    toISOString: () => d.toISOString(),
    toString: () => d.toLocaleString("en-IN"),
    toLocaleString: (...args) => d.toLocaleString(...(args.length ? args : ["en-IN"])),
    toLocaleDateString: (...args) => d.toLocaleDateString(...(args.length ? args : ["en-IN"])),
    toLocaleTimeString: (...args) => d.toLocaleTimeString(...(args.length ? args : ["en-IN"])),
    seconds: Math.floor(d.getTime() / 1000),
    nanoseconds: (d.getTime() % 1000) * 1000000,
    toJSON: () => d.toISOString(),
  };
}

const iso = "2026-10-14T10:49:18.509Z";
const ts = createTimestamp(iso);
console.log("toDate():", ts.toDate());
console.log("toDate().toLocaleString():", ts.toDate().toLocaleString());
console.log("ts.seconds:", ts.seconds);
console.log("ts.toLocaleString():", ts.toLocaleString());
console.log("q.createdAt?.toDate ? q.createdAt.toDate().toLocaleString() : '-':", ts?.toDate ? ts.toDate().toLocaleString() : "-");
console.log("b.createdAt.seconds - a.createdAt.seconds:", ts.seconds - 1000);
console.log("JSON.stringify:", JSON.stringify({ createdAt: ts }));

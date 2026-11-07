// 版本比较:逐段数值比较,不信字符串字典序("0.10.0" > "0.9.0" 按字典序是 false)
export function versionGt(a, b) {
  const pa = (a || '').split('.').map(Number);
  const pb = (b || '').split('.').map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x > y) return true;
    if (x < y) return false;
  }
  return false; // equal
}

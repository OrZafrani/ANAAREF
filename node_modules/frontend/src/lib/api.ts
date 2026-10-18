export async function getHealth(): Promise<any> {
  const res = await fetch('/health');
  if (!res.ok) {
    throw new Error('Failed to fetch health');
  }
  return res.json();
}

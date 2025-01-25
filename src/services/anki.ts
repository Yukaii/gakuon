export async function ankiRequest(host: string, action: string, params = {}) {
  const response = await fetch(host, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, version: 6, params })
  });
  const data = await response.json();
  if (data.error) throw new Error(data.error);
  return data.result;
}

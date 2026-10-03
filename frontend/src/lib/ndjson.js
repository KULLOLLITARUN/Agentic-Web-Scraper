// Yields one parsed object per line of a newline-delimited JSON response body.
export async function* readNdjson(response) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value, { stream: !done });

    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (line.trim()) yield JSON.parse(line);
    }

    if (done) {
      if (buffer.trim()) yield JSON.parse(buffer);
      return;
    }
  }
}

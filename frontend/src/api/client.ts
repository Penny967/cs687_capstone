export async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body
        ? { "Content-Type": "application/json" }
        : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message =
      `Request failed with status ${response.status}.`;

    try {
      const body = (await response.json()) as {
        detail?:
          | string
          | Array<{ msg?: string }>;
      };

      if (typeof body.detail === "string") {
        message = body.detail;
      } else if (Array.isArray(body.detail)) {
        message = body.detail
          .map(
            (item) =>
              item.msg ?? "Validation error"
          )
          .join("; ");
      }
    } catch {
      // Keep default error message.
    }

    throw new Error(message);
  }

  return (await response.json()) as T;
}
# Privacy

## Data handling

- Conversations, feedback, approved memory, and product events are stored in the current browser's `localStorage`.
- The application does not include user accounts or a server-side conversation database.
- OpenAI requests use `store: false`.
- Anonymous product events exclude raw prompts and personal identifiers by default.
- Users can edit, delete, clear, or export approved memory and export anonymous product events.

## External requests

The server sends the minimum task context needed for intent parsing to OpenAI and sends structured search parameters to Yahoo! JAPAN APIs. API credentials remain in server environment variables and are not returned to the browser.

## Important limits

Browser storage is not encrypted and is visible to anyone with access to the same browser profile or developer tools. Do not enter sensitive personal, payment, health, or authentication information. Clearing browser site data removes local Agent yh state.

`store: false` disables Responses API application-state storage for these calls; it should not be described as a universal zero-retention guarantee.

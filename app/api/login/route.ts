import { serveWithEmail } from 'lib/deps'
import { handleLogin } from 'lib/handlers/login'

export const POST = serveWithEmail(handleLogin)

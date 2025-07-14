// src/handlers/executor.js
import actions from './actions.js';

export async function executeIntent(intentPayload, msg = null, client = null) {
  const { intent, args = {}, safety_check = true } = intentPayload;

  if (!safety_check) return { status: 'error', message: 'Safety check failed or not allowed.' };

  const action = actions[intent];
  if (!action) return { status: 'error', message: `Unknown intent: ${intent}` };

  try {
    const context = { msg, client };
    const result = await action(args, context);
    return { status: 'success', data: result };
  } catch (error) {
    return { status: 'error', message: `Execution failed: ${error.message}` };
  }
}

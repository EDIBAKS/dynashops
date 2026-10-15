import { supabase } from 'boot/supabase'
import { useAuth } from 'stores/auth'

// Supported business events recorded in the activity log.
export const ACTIVITY_TYPES = {
  SALE_CREATED: 'Sale Created',
  SALE_EDITED: 'Sale Edited',
  RECEIPT_DELETED: 'Receipt Deleted',
  DISPATCH: 'Dispatch',
  DISPATCH_REVERSAL: 'Dispatch Reversal',
  DEBT_ENTRY: 'Debt Entry',
  DEBT_REMOVED: 'Debt Removed',
  PROMO_RETURN: 'Promo Return',
  EXPIRY_RETURN: 'Expiry Return',
  WITHDRAWAL: 'Withdrawal',
}

// Fire-and-forget: a logging failure must never break the user's action.
export async function logActivity(
  activity,
  { reference = null, description = null, dpccode = null } = {},
) {
  try {
    const auth = useAuth()
    const details = auth.userDetails
    const username =
      [details?.firstname, details?.lastname].filter(Boolean).join(' ') ||
      auth.user?.email ||
      'Unknown'

    const { error } = await supabase.from('activity_logs').insert({
      user_id: auth.user?.id,
      username,
      activity,
      reference,
      description,
      dpccode,
    })
    if (error) console.warn('Activity log failed:', error.message)
  } catch (err) {
    console.warn('Activity log failed:', err?.message || err)
  }
}

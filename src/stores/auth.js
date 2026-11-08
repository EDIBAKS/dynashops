import { defineStore } from 'pinia'
import { supabase } from 'boot/supabase'
import { activityStorageKey } from '../utils/inactivity'

export const useAuth = defineStore('auth', {
  // Holds the active identity and inactivity timeout configuration.
  state: () => ({
    user: null, // Supabase auth user
    userDetails: null, // Additional user details from `shopusers` table
    inactivityLimit: 10 * 60 * 1000, // 10 minutes (in milliseconds)
    inactivityRemaining: 0,
  }),

  actions: {
    // ✅ Login and fetch additional user details
    async login(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      localStorage.setItem(activityStorageKey, JSON.stringify({ userId: data.user.id, at: Date.now() }))
      await this.fetchUserDetails(data.user.id)
      this.user = data.user
      this.persistToLocalStorage()
    },

    // ✅ Called on app start to check if there's a logged-in user
    async fetchUser() {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession()
      if (sessionError) throw sessionError
      if (!sessionData.session) {
        this.clearSession()
        return
      }
      const { data: { user }, error } = await supabase.auth.getUser()
      if (error) throw error

      if (user) {
        await this.fetchUserDetails(user.id)
        this.user = user
        this.persistToLocalStorage()
      } else {
        this.clearSession()
      }
    },

    // ✅ Fetch additional user details from Supabase `shopusers` table
    async fetchUserDetails(userId) {
      const { data, error } = await supabase
        .from('shopusers')
        .select('*')
        .eq('userid', userId)
        .single()

      if (error) throw error
      this.userDetails = data
    },

    // ✅ Logout user (can be triggered manually or automatically)
    async logout(showMessage = false) {
      if (showMessage) sessionStorage.setItem('session-expired', '1')
      const { error } = await supabase.auth.signOut(showMessage ? { scope: 'local' } : undefined)
      if (error) {
        if (showMessage) sessionStorage.removeItem('session-expired')
        throw error
      }
      this.clearSession()
    },

    clearSession() {
      this.user = null
      this.userDetails = null
      this.inactivityRemaining = 0
      localStorage.removeItem('auth-store')
      localStorage.removeItem(activityStorageKey)
    },

    // ✅ Persist to localStorage
    persistToLocalStorage() {
      localStorage.setItem(
        'auth-store',
        JSON.stringify({
          user: this.user,
          userDetails: this.userDetails,
        }),
      )
    },

    // ✅ Update profile in `users` table
    async updateProfile({ names, username, telephone, department }) {
      if (!this.user) throw new Error('User not logged in')

      const { error } = await supabase
        .from('users')
        .update({ names, username, telephone, department })
        .eq('id', this.user.id)

      if (error) throw error

      // Refresh and persist updated details
      await this.fetchUserDetails(this.user.id)
      this.persistToLocalStorage()
    },

    // ✅ Update password in Supabase Auth
    async updatePassword(newPassword) {
      if (!this.user) throw new Error('User not logged in')

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      })

      if (error) throw error
    },

  },
})

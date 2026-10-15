import { defineStore } from 'pinia'
import { supabase } from 'boot/supabase'

export const useAuth = defineStore('auth', {
  // Holds the active identity and inactivity timeout configuration.
  state: () => ({
    user: null, // Supabase auth user
    userDetails: null, // Additional user details from `shopusers` table
    inactivityTimer: null, // Timer reference
    inactivityLimit: 10 * 60 * 1000, // 10 minutes (in milliseconds)
  }),

  actions: {
    // ✅ Login and fetch additional user details
    async login(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error

      this.user = data.user
      await this.fetchUserDetails(data.user.id)
      this.persistToLocalStorage()

      // clear old timers and start new one
      this.clearInactivityTimer()
      this.startInactivityTimer()
    },

    // ✅ Called on app start to check if there's a logged-in user
    async fetchUser() {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      this.user = user

      if (user) {
        await this.fetchUserDetails(user.id)
        this.persistToLocalStorage()

        // only start a timer if one doesn’t already exist
        if (!this.inactivityTimer) this.startInactivityTimer()
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
      // The login page reads this flag and explains why the user was signed out
      if (showMessage) sessionStorage.setItem('session-expired', '1')

      await supabase.auth.signOut()
      this.clearInactivityTimer()
      this.user = null
      this.userDetails = null
      localStorage.removeItem('auth-store')
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

    // ✅ Load from localStorage on app start
    loadFromLocalStorage() {
      const saved = localStorage.getItem('auth-store')
      if (saved) {
        const parsed = JSON.parse(saved)
        this.user = parsed.user
        this.userDetails = parsed.userDetails
      }
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

    // ✅ Inactivity timer logic
    startInactivityTimer() {
      this.clearInactivityTimer()

      this.inactivityTimer = setTimeout(() => {
        console.log(
          `⏰ Inactivity limit of ${this.inactivityLimit / 1000 / 60} minute(s) reached — logging out user.`,
        )
        this.logout(true) // Auto-logout after inactivity
      }, this.inactivityLimit)
    },

    resetInactivityTimer() {
      if (this.user) {
        this.startInactivityTimer() // restart only if logged in
      }
    },

    clearInactivityTimer() {
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer)
        this.inactivityTimer = null
      }
    },
  },
})

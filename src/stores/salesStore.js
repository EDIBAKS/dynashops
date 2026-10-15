// stores/salesStore.js
import { defineStore } from 'pinia'
import { supabase } from '../boot/supabase'

// 🔹 Helper function to format local date-time
//function getLocalDateTime() {
//  const now = new Date()
//  const year = now.getFullYear()
//  const month = String(now.getMonth() + 1).padStart(2, '0')
//  const day = String(now.getDate()).padStart(2, '0')
//  const hours = String(now.getHours()).padStart(2, '0')
//  const minutes = String(now.getMinutes()).padStart(2, '0')
//  const seconds = String(now.getSeconds()).padStart(2, '0')

// 👇 no timezone, this is your actual wall-clock time
//  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`
//}

export const useSalesStore = defineStore('salesStore', {
  // Sale draft data and catalog entries shared across sales components.
  state: () => ({
    products: [],
    salesItems: [],
    headerData: {
      receiptno: '',
      salesdate: '',
      distributoridno: '',
      dpccode: '',
      exchangeRate: '',
    },
  }),

  // Load catalog data, update the draft, and submit completed sales.
  actions: {
    async fetchProducts() {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('status', 'active') // Filter by status
        .order('productname', { ascending: true })

      if (error) throw error
      this.products = data
    },

    async fetchExchangeRate() {
      const { data, error } = await supabase.from('ExchangeRate').select('"Rate"').limit(1)

      if (error) throw error
      if (data && data.length > 0) {
        this.headerData.exchangeRate = data[0].Rate
      } else {
        this.headerData.exchangeRate = 'Not Set'
        console.warn('No exchange rate found in database.')
      }
    },

    getProductByCode(code) {
      return this.products.find((p) => p.productcode === code)
    },

    addItemToList(selectedProduct, quantity) {
      const existing = this.salesItems.find(
        (item) => item.productcode === selectedProduct.productcode,
      )
      if (existing) {
        existing.quantity += quantity
        existing.totalprice = existing.quantity * existing.distributorprice
        existing.totalbv = existing.quantity * existing.bvs
      } else {
        this.salesItems.push({
          ...selectedProduct,
          quantity,
          totalprice: selectedProduct.distributorprice * quantity,
          totalbv: selectedProduct.bvs * quantity,
        })
      }
    },

    removeItem(index) {
      this.salesItems.splice(index, 1)
    },

    async submitSale(form) {
      try {
        // 💡 Deep clone to avoid reactive refs leaking
        const payload = JSON.parse(JSON.stringify(form))

        // 🔥 Call your PostgreSQL transaction function
        const { error } = await supabase.rpc('insert_sales_transaction', { payload })

        if (error) throw error

        console.log('Sale submitted successfully via RPC.')
        return { success: true }
      } catch (error) {
        console.error('Failed to submit sale via RPC:', error.message)
        return { success: false, error }
      }
    },
  },
})

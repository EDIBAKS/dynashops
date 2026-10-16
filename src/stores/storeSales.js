import { defineStore } from 'pinia'
import { supabase } from 'boot/supabase'

export const useSaleStore = defineStore('sales', {
  // Holds report results, loading state, and the saved filters.
  state: () => ({
    sales: [], // combined header + details data
    salesTally: [], // ← must default to empty array
    currentStock: [],
    loading: false,
    distributorDetailsLoading: false,
    error: null,
    bestCustomers: [], // ✅ this is what component will use
    // initialize from localStorage
    startDate: localStorage.getItem('reportStartDate') || null,
    endDate: localStorage.getItem('reportEndDate') || null,
    dpccode: localStorage.getItem('reportDpccode') || '',
  }),

  // Query sales and manage the associated report filters.
  actions: {
    // update filters and persist to localStorage
    setFilters({ startDate, endDate, dpccode }) {
      this.startDate = startDate
      this.endDate = endDate
      this.dpccode = dpccode

      localStorage.setItem('reportStartDate', startDate)
      localStorage.setItem('reportEndDate', endDate)
      localStorage.setItem('reportDpccode', dpccode)
    },
    // --- FETCH SALES LIST WITH NAMES ---
    async fetchSales(start = this.startDate, end = this.endDate, dpc = this.dpccode) {
      this.loading = true
      this.error = null
      try {
        if (!dpc) throw new Error('DPC code is required')

        // 1️⃣ Fetch sales headers + details (IDs only)
        const { data: salesData, error: salesError } = await supabase
          .from('salesheader')
          .select(
            'receiptno, distributoridno, salesdate, createdby, dpccode, status,lastmodified, salesdetails(productcode, unitprice, unitbv, quantity)',
          )
          .gte('salesdate', start)
          .lte('salesdate', end)
          .eq('dpccode', dpc)
          .order('salesdate', { ascending: false })

        if (salesError) throw salesError

        const sales = salesData || []
        if (!sales.length) {
          this.sales = []
          return
        }

        // 2️⃣ Collect unique distributor IDs and product codes from sales
        const distributorIds = [...new Set(sales.map((s) => s.distributoridno))]
        const productCodes = [
          ...new Set(sales.flatMap((s) => (s.salesdetails || []).map((item) => item.productcode))),
        ]

        //console.log('📌 Distributor IDs to fetch:', distributorIds)
        //console.log('📌 Product Codes to fetch:', productCodes)

        // 3️⃣ Fetch only those distributors using ilike (case-insensitive)
        // 3️⃣ Fetch only those distributors using uppercase IDs
        const distributors = []
        for (const id of distributorIds) {
          const upperId = id.toUpperCase() // ensure uppercase

          const { data, error } = await supabase
            .from('Distributors') // remove quotes in REST call
            .select('DistributorIDNO, DistributorNames')
            .eq('DistributorIDNO', upperId) // exact match with uppercase

          if (error) console.error('Distributor fetch error for', upperId, error)
          if (data && data.length) distributors.push(data[0])
        }

        //console.log('✅ Distributors fetched:', distributors)

        // 4️⃣ Fetch only products in the selected sales
        const { data: productsData, error: prodError } = await supabase
          .from('products')
          .select('productcode, productname')
          .in('productcode', productCodes)

        if (prodError) console.error('Product fetch error:', prodError)
        const products = productsData || []
        //console.log('✅ Products fetched:', products)

        // 5️⃣ Build lookup objects
        const distributorLookup = distributors.reduce((acc, d) => {
          acc[d.DistributorIDNO] = d.DistributorNames
          return acc
        }, {})

        const productLookup = products.reduce((acc, p) => {
          acc[p.productcode] = p.productname
          return acc
        }, {})

        // 6️⃣ Map sales with names
        this.sales = sales.map((sale) => ({
          ...sale,
          distributorname: distributorLookup[sale.distributoridno] || '',
          salesdetails: (sale.salesdetails || []).map((item) => ({
            ...item,
            productname: productLookup[item.productcode] || '',
          })),
        }))

        //console.log('✅ Final mapped sales:', this.sales)
      } catch (err) {
        console.error('fetchSales error:', err)
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    async bestCustomer(start = this.startDate, end = this.endDate, dpc = this.dpccode) {
      this.loading = true
      this.error = null

      try {
        if (!dpc) throw new Error('DPC code is required')

        // 1️⃣ Fetch sales header + nested salesdetails
        const { data: salesData, error: salesError } = await supabase
          .from('salesheader')
          .select('receiptno, distributoridno, dpccode, salesdate, salesdetails(unitbv, quantity)')
          .gte('salesdate', start)
          .lte('salesdate', end)
          .eq('dpccode', dpc)

        if (salesError) throw salesError
        if (!salesData || !salesData.length) {
          this.bestCustomers = []
          return []
        }

        // 2️⃣ Aggregate total BV per distributor
        const bvTotals = {}
        salesData.forEach((sale) => {
          const totalBV = (sale.salesdetails || []).reduce(
            (sum, item) => sum + item.unitbv * item.quantity,
            0,
          )
          bvTotals[sale.distributoridno] = (bvTotals[sale.distributoridno] || 0) + totalBV
        })

        // 3️⃣ Sort distributors by TotalBV descending
        const sortedBv = Object.entries(bvTotals)
          .sort((a, b) => b[1] - a[1])
          .map(([distributoridno, totalBV]) => ({ distributoridno, totalBV }))

        // 4️⃣ Fetch distributor info
        const distributorIds = sortedBv.map((d) => d.distributoridno)
        const { data: distributorData, error: distError } = await supabase
          .from('Distributors')
          .select('DistributorIDNO, DistributorNames, DistributorTelephone1')
          .in('DistributorIDNO', distributorIds)

        if (distError) throw distError

        const distLookup = (distributorData || []).reduce((acc, d) => {
          acc[d.DistributorIDNO] = {
            name: d.DistributorNames,
            telephone: d.DistributorTelephone1,
          }
          return acc
        }, {})

        // 5️⃣ Combine BV totals with distributor info
        const bestCustomers = sortedBv.map((item) => ({
          DistributorIDNO: item.distributoridno,
          DistributorNames: distLookup[item.distributoridno]?.name || 'Unknown',
          DistributorTelephone: distLookup[item.distributoridno]?.telephone || 'N/A',
          TotalBV: item.totalBV,
        }))

        // 6️⃣ Store in local state
        this.bestCustomers = bestCustomers
        return bestCustomers
      } catch (err) {
        console.error('bestCustomer error:', err)
        this.error = err.message
        this.bestCustomers = []
        return []
      } finally {
        this.loading = false
      }
    },

    // --- FETCH SALES LIST WITH NAMES ---
    async fetchQueriedSales(start = this.startDate, end = this.endDate, dpc = this.dpccode) {
      this.loading = true
      this.error = null
      try {
        if (!dpc) throw new Error('DPC code is required')

        // 1️⃣ Fetch sales headers + details (IDs only)
        const { data: salesData, error: salesError } = await supabase
          .from('salesheader')
          .select(
            'receiptno, distributoridno, salesdate, createdby, dpccode, status, lastmodified, salesdetails(productcode, unitprice, unitbv, quantity)',
          )
          .gte('salesdate', start)
          .lte('salesdate', end)
          .eq('dpccode', dpc)
          .eq('status', 'pending') // ✅ Only fetch pending sales
          .order('salesdate', { ascending: false })

        if (salesError) throw salesError

        const sales = salesData || []
        if (!sales.length) {
          this.sales = []
          console.log('⚠️ No sales found for given query range and DPC.')
          return
        }

        // 2️⃣ Collect unique distributor IDs and product codes from sales
        const distributorIds = [...new Set(sales.map((s) => s.distributoridno))]
        const productCodes = [
          ...new Set(sales.flatMap((s) => (s.salesdetails || []).map((item) => item.productcode))),
        ]

        // 3️⃣ Fetch only those distributors using uppercase IDs
        const distributors = []
        for (const id of distributorIds) {
          const upperId = id.toUpperCase() // ensure uppercase

          const { data, error } = await supabase
            .from('Distributors')
            .select('DistributorIDNO, DistributorNames')
            .eq('DistributorIDNO', upperId)

          if (error) console.error('Distributor fetch error for', upperId, error)
          if (data && data.length) distributors.push(data[0])
        }

        // 4️⃣ Fetch only products in the selected sales
        const { data: productsData, error: prodError } = await supabase
          .from('products')
          .select('productcode, productname')
          .in('productcode', productCodes)

        if (prodError) console.error('Product fetch error:', prodError)
        const products = productsData || []

        // 5️⃣ Build lookup objects
        const distributorLookup = distributors.reduce((acc, d) => {
          acc[d.DistributorIDNO] = d.DistributorNames
          return acc
        }, {})

        const productLookup = products.reduce((acc, p) => {
          acc[p.productcode] = p.productname
          return acc
        }, {})

        // 6️⃣ Map sales with names
        this.sales = sales.map((sale) => ({
          ...sale,
          distributorname: distributorLookup[sale.distributoridno] || '',
          salesdetails: (sale.salesdetails || []).map((item) => ({
            ...item,
            productname: productLookup[item.productcode] || '',
          })),
        }))

        // ✅ Log the final fetched data
        console.log('✅ Fetched and mapped sales data:', this.sales)
      } catch (err) {
        console.error('❌ fetchQueriedSales error:', err)
        this.error = err.message
      } finally {
        this.loading = false
      }
    },

    // Fetch a sale by receipt number (header + details)
    async fetchSaleByReceipt(receiptno) {
      this.loading = true
      this.error = null
      try {
        const { data: headerData, error: headerError } = await supabase
          .from('salesheader')
          .select('*')
          .eq('receiptno', receiptno)
          .single()

        if (headerError) throw headerError

        const { data: detailsData, error: detailsError } = await supabase
          .from('salesdetails')
          .select('*')
          .eq('receiptno', receiptno)

        if (detailsError) throw detailsError

        // Combine header + details
        this.selectedSale = {
          ...headerData,
          salesdetails: detailsData || [],
        }
      } catch (err) {
        this.error = err.message
        this.selectedSale = null
      } finally {
        this.loading = false
      }
    },
    // Update a sale (header + added/edited/deleted details)
    async updateReceipt({ header, changedItems = [], deletedItems = [] }) {
      this.loading = true
      this.error = null

      try {
        // --- 1) Update header fields ---
        const { error: headerError } = await supabase
          .from('salesheader')
          .update({
            distributoridno: header.distributoridno,
            dpccode: header.dpccode,
            salesdate: header.salesdate,
            lastmodified: new Date(),
            lastmodifiedby: header.lastmodifiedby ?? null,
          })
          .eq('receiptno', header.receiptno)

        if (headerError) throw headerError

        // --- 2) Bulk delete removed products (if any) ---
        if (Array.isArray(deletedItems) && deletedItems.length > 0) {
          const productCodes = deletedItems.map((d) => d.productcode).filter(Boolean)
          if (productCodes.length > 0) {
            const { error: delError } = await supabase
              .from('salesdetails')
              .delete()
              .eq('receiptno', header.receiptno)
              .in('productcode', productCodes)
            if (delError) throw delError
          }
        }

        // --- 3) Insert or update changed products ---
        // We'll attempt an UPDATE first. If it affects 0 rows, INSERT.
        // Process sequentially to avoid race conditions and simplify error handling.
        if (Array.isArray(changedItems) && changedItems.length > 0) {
          for (const item of changedItems) {
            // Defensive defaults
            const payload = {
              quantity: Number(item.quantity) || 0,
              unitprice: Number(item.unitprice) || 0,
              unitbv: Number(item.unitbv) || 0,
            }

            // Try update
            const { data: updatedRows, error: updateErr } = await supabase
              .from('salesdetails')
              .update(payload)
              .eq('receiptno', header.receiptno)
              .eq('productcode', item.productcode)
              .select() // returns updated rows
            if (updateErr) throw updateErr

            // If nothing was updated, insert new detail row
            if (!updatedRows || updatedRows.length === 0) {
              const { error: insertErr } = await supabase.from('salesdetails').insert({
                receiptno: header.receiptno,
                productcode: item.productcode,
                quantity: payload.quantity,
                unitprice: payload.unitprice,
                unitbv: payload.unitbv,
              })
              if (insertErr) throw insertErr
            }
          }
        }

        // --- 4) If no salesdetails remain -> delete header (receipt) ---
        const { data: remainingDetails, error: countErr } = await supabase
          .from('salesdetails')
          .select('salesindex', { count: 'exact' })
          .eq('receiptno', header.receiptno)

        if (countErr) throw countErr

        if (!remainingDetails || remainingDetails.length === 0) {
          // No details -> delete header
          const { error: delHeaderError } = await supabase
            .from('salesheader')
            .delete()
            .eq('receiptno', header.receiptno)

          if (delHeaderError) throw delHeaderError

          // Refresh internal state after deletion
          this.selectedSale = null
          // Note: if you call fetchSales etc. below, it will not find the receipt.
          this.loading = false
          return
        }

        // --- 5) Editing a receipt marks it correct (clears pending) ---
        const { error: statusError } = await supabase
          .from('salesheader')
          .update({ status: 'correct', lastmodified: new Date() })
          .eq('receiptno', header.receiptno)
        if (statusError) throw statusError

        // --- 6) Refresh local sale and sales list as before ---
        await this.fetchSaleByReceipt(header.receiptno)

        if (this.startDate && this.endDate && this.dpccode) {
          await this.fetchSales(this.startDate, this.endDate, this.dpccode)
        }
      } catch (err) {
        this.error = err.message || String(err)
        throw err
      } finally {
        this.loading = false
      }
    },

    // in store
    async fetchSalesRaw(start, end, dpccode, { includeDistributorDetails = false } = {}) {
      this.loading = true
      this.distributorDetailsLoading = includeDistributorDetails
      this.error = null
      try {
        if (!dpccode) throw new Error('DPC code is required')

        if (includeDistributorDetails) this.salesTally = []

        // 1️⃣ Fetch salesheader + salesdetails (unitprice included)
        const { data: salesData, error } = await supabase
          .from('salesheader')
          .select(
            `
        receiptno,
        distributoridno,
        salesdate,
        dpccode,
        salesdetails(
          productcode,
          unitprice,
          unitbv,
          quantity
        )
      `,
          )
          .gte('salesdate', start)
          .lte('salesdate', end)
          .eq('dpccode', dpccode)
          .order('salesdate', { ascending: true })

        if (error) throw error
        const sales = salesData || []
        if (!sales.length) {
          this.salesTally = []
          return
        }

        this.salesTally = sales.map((sale) => ({
          ...sale,
          distributorname: '',
          distributortelephone: '',
          salesdetails: (sale.salesdetails || []).map((item) => ({
            ...item,
            distributorprice: item.unitprice || 0,
            bvs: Number(item.unitbv) || 0,
          })),
        }))

        let distributorLookup = {}

        if (includeDistributorDetails && sales.length) {
          const salesDistributorIds = [
            ...new Set(
              sales.map((sale) => String(sale.distributoridno || '').trim()).filter(Boolean),
            ),
          ]
          const distributorIds = [
            ...new Set(
              salesDistributorIds.flatMap((id) => [id, id.toUpperCase(), id.toLowerCase()]),
            ),
          ]
          if (distributorIds.length) {
            const { data: distributorData, error: distributorError } = await supabase
              .from('Distributors')
              .select('DistributorIDNO, DistributorNames, DistributorTelephone1')
              .in('DistributorIDNO', distributorIds)

            if (distributorError) throw distributorError

            distributorLookup = (distributorData || []).reduce((lookup, distributor) => {
              lookup[String(distributor.DistributorIDNO || '').trim().toUpperCase()] = {
                name: distributor.DistributorNames,
                telephone: distributor.DistributorTelephone1,
              }
              return lookup
            }, {})

            this.salesTally = this.salesTally.map((sale) => {
              const distributor = distributorLookup[
                String(sale.distributoridno || '').trim().toUpperCase()
              ]
              return {
                ...sale,
                distributorname: distributor?.name || '',
                distributortelephone: distributor?.telephone || '',
              }
            })
          }
          this.distributorDetailsLoading = false
        }

        // 2️⃣ Collect unique product codes to fetch names/BV only
        const productCodes = [
          ...new Set(sales.flatMap((s) => (s.salesdetails || []).map((d) => d.productcode))),
        ]

        // 3️⃣ Fetch products info (only productname and bvs)
        const { data: productsData, error: prodError } = await supabase
          .from('products')
          .select('productcode, productname, bvs')
          .in('productcode', productCodes)

        if (prodError) console.error('Product fetch error:', prodError)
        const products = productsData || []

        // 4️⃣ Build product lookup
        const productLookup = products.reduce((acc, p) => {
          acc[p.productcode] = p
          return acc
        }, {})

        // 5️⃣ Map product info into salesdetails, use unitprice from salesdetails
        this.salesTally = sales.map((sale) => ({
          ...sale,
          distributorname:
            distributorLookup[String(sale.distributoridno || '').trim().toUpperCase()]?.name || '',
          distributortelephone:
            distributorLookup[String(sale.distributoridno || '').trim().toUpperCase()]?.telephone ||
            '',
          salesdetails: (sale.salesdetails || []).map((item) => ({
            ...item,
            productname: productLookup[item.productcode]?.productname || '',
            distributorprice: item.unitprice || 0, // <-- use unitprice
            bvs: productLookup[item.productcode]?.bvs || 0,
          })),
        }))
        // 🔹 Debug: log the final salesTally
        //console.log('📌 Fetched salesTally:', this.salesTally)
      } catch (err) {
        console.error('fetchSalesRaw error:', err)
        this.error = err.message
        this.salesTally = []
      } finally {
        this.loading = false
        this.distributorDetailsLoading = false
      }
    },

    async fetchPersonalSales(startDate, endDate, distributorIDNO) {
      this.loading = true
      this.error = null
      try {
        if (!distributorIDNO) throw new Error('Distributor ID is required')

        // 1️⃣ Fetch salesheaders + nested salesdetails
        const { data: salesData, error: salesError } = await supabase
          .from('salesheader')
          .select(
            `
            receiptno,
            distributoridno,
            salesdate,
            createdby,
            dpccode,
            status,
            salesdetails(
              productcode,
              unitprice,
              unitbv,
              quantity
            )
          `,
          )
          .eq('distributoridno', distributorIDNO)
          .gte('salesdate', startDate)
          .lte('salesdate', endDate)
          .order('salesdate', { ascending: false })

        if (salesError) throw salesError

        const sales = salesData || []
        if (!sales.length) {
          this.sales = []
          return
        }

        // 2️⃣ Fetch distributor info using ilike for case-insensitive match
        const { data: distributorData, error: distError } = await supabase
          .from('Distributors')
          .select('DistributorIDNO, DistributorNames, DistributorPosition, RegisteredDPC')
          .ilike('DistributorIDNO', distributorIDNO)

        if (distError) throw distError

        const distributor = (distributorData && distributorData[0]) || {}

        // 3️⃣ Collect all product codes from these sales
        const productCodes = [
          ...new Set(sales.flatMap((s) => (s.salesdetails || []).map((d) => d.productcode))),
        ]

        // 4️⃣ Fetch only products in these sales
        const { data: productsData, error: prodError } = await supabase
          .from('products')
          .select('productcode, productname')
          .in('productcode', productCodes)

        if (prodError) throw prodError

        const productLookup = (productsData || []).reduce((acc, p) => {
          acc[p.productcode] = p.productname
          return acc
        }, {})

        // 5️⃣ Map product names and distributor info into sales
        this.sales = sales.map((sale) => ({
          ...sale,
          distributorname: distributor.DistributorNames || '',
          distributorposition: distributor.DistributorPosition || '',
          registereddpc: distributor.RegisteredDPC || '',
          salesdetails: (sale.salesdetails || []).map((item) => ({
            ...item,
            productname: productLookup[item.productcode] || '',
          })),
        }))

        console.log('✅ Personal sales with distributor info fetched:', this.sales)
      } catch (err) {
        console.error('fetchPersonalSales error:', err)
        this.error = err.message
      } finally {
        this.loading = false
      }
    },
    async toggleStatus(receiptno, salesdate, userRole) {
      this.loading = true
      this.error = null

      try {
        const { data, error } = await supabase
          .from('salesheader')
          .select('status')
          .eq('receiptno', receiptno)
          .eq('salesdate', salesdate)
          .single()

        if (error) throw error
        if (!data) throw new Error('Receipt not found')

        // Restrict role permissions
        if (data.status === 'pending' && !['Admin', 'SuperAdmin'].includes(userRole)) {
          throw new Error('Only Admin or SuperAdmin can unpend sales.')
        }

        // Toggle only between correct and pending
        const newStatus = data.status === 'correct' ? 'pending' : 'correct'

        const { error: updateError } = await supabase
          .from('salesheader')
          .update({
            status: newStatus,
            lastmodified: new Date(),
          })
          .eq('receiptno', receiptno)
          .eq('salesdate', salesdate)

        if (updateError) throw updateError

        const idx = this.sales.findIndex(
          (s) => s.receiptno === receiptno && s.salesdate === salesdate,
        )
        if (idx !== -1) {
          this.sales[idx].status = newStatus
          this.sales[idx].lastmodified = new Date()
        }

        return newStatus
      } catch (err) {
        this.error = err.message
        throw err
      } finally {
        this.loading = false
      }
    },
  },
  getters: {},
})

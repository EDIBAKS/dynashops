<template>
  <q-page class="flex flex-center bg-grey-2">
    <q-card
      class="q-pa-lg q-mx-md shadow-4"
      style="width: 100%; max-width: 500px; border-radius: 1rem"
      @mouseover="hover = true"
      @mouseleave="hover = false"
      :class="{ hovered: hover }"
    >
      <q-card-section>
        <div class="text-h6">User Registration</div>
      </q-card-section>

      <!-- Collect account details, location, and role. -->
      <q-form @submit.prevent="registerUser">
        <q-input v-model="form.firstname" label="First Name" outlined dense class="q-mb-sm" />
        <q-input v-model="form.lastname" label="Last Name" outlined dense class="q-mb-sm" />
        <q-input v-model="form.email" label="Email" type="email" outlined dense class="q-mb-sm" />
        <q-input
          v-model="form.password"
          ref="passwordInput"
          label="Password"
          type="password"
          outlined
          dense
          class="q-mb-sm"
        />

        <q-input
          v-model="form.repeatpassword"
          ref="repeatPasswordInput"
          label="Repeat Password"
          type="password"
          outlined
          dense
          class="q-mb-sm"
          :error="!!passwordError"
          :error-message="passwordError"
          @blur="validatePasswords"
        />

        <q-input v-model="form.telephone" label="Telephone" outlined dense class="q-mb-sm" />
        <q-input v-model="form.address" label="Address" outlined dense class="q-mb-sm" />
        <q-input
          v-model="form.dob"
          label="Date of Birth"
          type="date"
          outlined
          dense
          class="q-mb-sm"
        />

        <!-- Country Select -->
        <q-select
          v-model="selected_country"
          :options="countries"
          label="Select Country"
          outlined
          dense
          emit-value
          map-options
          @update:model-value="fetchProvinces"
          class="q-mb-sm"
        />

        <!-- Province Select -->
        <q-select
          v-model="selected_province"
          :options="provinces"
          label="Select Province"
          outlined
          dense
          emit-value
          map-options
          :disable="!provinces.length"
          class="q-mb-sm"
        />

        <!-- DPC Select -->
        <q-select
          v-model="selected_dpc"
          :options="dpcs"
          label="Select Shop"
          outlined
          dense
          emit-value
          map-options
          :disable="!dpcs.length"
          class="q-mb-sm"
        />

        <q-select
          v-model="selected_role"
          :options="roles"
          label="Access Role"
          outlined
          dense
          emit-value
          map-options
          class="q-mb-sm"
        />

        <q-btn type="submit" label="Register" color="primary" class="full-width q-mt-md" />
      </q-form>
    </q-card>
  </q-page>
</template>

<script setup>
// Vue reactivity and services for registration and location lookups.
import { ref, reactive, onMounted, watch } from 'vue'
import { supabase } from 'boot/supabase'
import { useQuasar } from 'quasar'
// Registration form values and available location/role options.
const $q = useQuasar()
const hover = ref(false)
const selected_country = ref('')
const selected_province = ref('')
const selected_dpc = ref('')
const selected_role = ref('')
const form = reactive({
  firstname: '',
  lastname: '',
  password: '',
  repeatpassword: '',
  email: '',
  telephone: '',
  address: '',
  dob: '',
})

const countries = ref([])
const provinces = ref([])
const dpcs = ref([])
const roles = ref([])

// Load selectable countries, roles, provinces, and shops.
const fetchCountries = async () => {
  const { data, error } = await supabase
    .from('country')
    .select('name, code')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching countries:', error.message)
    return
  }

  countries.value = data.map((c) => ({
    label: c.name,
    value: c.code,
  }))
}
const fetchRoles = async () => {
  const { data, error } = await supabase
    .from('roles')
    .select('name, id')
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching countries:', error.message)
    return
  }

  roles.value = data.map((c) => ({
    label: c.name,
    value: c.name,
  }))
}

// Fetch provinces when country changes
const fetchProvinces = async (selected_country) => {
  if (!selected_country) {
    provinces.value = []
    return
  }

  const { data, error } = await supabase
    .from('province')
    .select('name, province_code')
    .eq('country_code', selected_country)
    .order('name', { ascending: true })

  if (error) {
    console.error('Error fetching provinces:', error.message)
    return
  }

  provinces.value = data.map((p) => ({
    label: p.name,
    value: p.province_code,
  }))
}

const fetchShops = async (selected_province) => {
  if (!selected_province) {
    dpcs.value = []
    return
  }

  const { data, error } = await supabase
    .from('shops')
    .select('id, shopcode, shop_name')
    .eq('province_code', selected_province)
    .eq('status', 'ACTIVE')
    .order('shop_name', { ascending: true }) // or 'shopcode' if preferred

  if (error) {
    console.error('Error fetching shops:', error.message)
    return
  }

  dpcs.value = data.map((shop) => ({
    label: `${shop.shop_name} (${shop.shopcode})`, // or just shop.shop_name
    value: shop.shopcode,
  }))
}

// Reset dependent selections whenever the chosen location changes.
watch(selected_country, (newCode) => {
  form.selected_province = '' // reset current selection
  fetchProvinces(newCode)
})

watch(selected_province, (newProvinceCode) => {
  dpcs.value = '' // reset current shop selection
  fetchShops(newProvinceCode)
})

// Validate and create the authentication account and user profile.
const registerUser = async () => {
  if (
    !form.email ||
    !form.password ||
    !form.firstname ||
    !form.lastname ||
    !form.dob ||
    !form.telephone ||
    !form.address ||
    !selected_country.value ||
    !selected_province.value ||
    !selected_dpc.value ||
    !selected_role.value
  ) {
    $q.notify({
      type: 'negative',
      message: 'Please fill in all required fields.',
    })
    return
  }

  // Create Supabase user
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email: form.email,
    password: form.password, // Replace with password input if needed
  })

  if (authError) {
    console.error('Signup Error:', authError.message)
    $q.notify({ type: 'negative', message: authError.message })
    return
  }

  const userId = authData.user?.id
  if (!userId) {
    $q.notify({ type: 'negative', message: 'User registration failed.' })
    return
  }

  // Insert additional details to shopUsers
  const { error: insertError } = await supabase.from('shopusers').insert({
    userid: userId,
    firstname: form.firstname,
    lastname: form.lastname,
    email: form.email,
    telephone: form.telephone,
    address: form.address,
    dob: form.dob,
    country_code: selected_country.value,
    province_code: selected_province.value,
    dpc_id: selected_dpc.value,
    role: selected_role.value,
  })

  if (insertError) {
    console.error('Insert Error:', insertError.message)
    $q.notify({ type: 'negative', message: insertError.message })
    return
  }

  $q.notify({
    type: 'positive',
    message: 'User registered successfully!',
  })

  // Optionally reset the form
  Object.assign(form, {
    firstname: '',
    lastname: '',
    email: '',
    telephone: '',
    address: '',
    dob: '',
  })
  selected_country.value = ''
  selected_province.value = ''
  selected_dpc.value = ''
  selected_role.value = ''
}

const passwordError = ref('')
const passwordInput = ref(null)
const repeatPasswordInput = ref(null)

const validatePasswords = () => {
  if (form.password !== form.repeatpassword) {
    passwordError.value = 'Passwords do not match.'
    form.password = ''
    form.repeatpassword = ''
    passwordInput.value?.focus()
  } else {
    passwordError.value = ''
  }
}

// Load countries on mount
onMounted(() => {
  fetchCountries()
  fetchRoles()
})
</script>

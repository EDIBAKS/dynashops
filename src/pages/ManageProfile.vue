<template>
  <q-page class="q-pa-md">
    <!-- Back Button -->
    <q-btn flat icon="arrow_back" label="Back" color="primary" class="q-mb-md" @click="goBack" />

    <q-card flat bordered class="q-pa-md">
      <!-- Tabs -->
      <q-tabs v-model="tab" class="text-primary" active-color="primary">
        <q-tab name="create" label="Create User" />
        <q-tab name="edit" label="Edit Profile" />
      </q-tabs>

      <q-separator />

      <q-tab-panels v-model="tab" animated>
        <!-- Create User Panel -->
        <q-tab-panel name="create">
          <div v-if="!isSuperAdmin">
            <q-banner class="bg-grey-2 text-black q-mb-md" dense rounded>
              Only SuperAdmins can create new users.
            </q-banner>
          </div>

          <q-form @submit.prevent="createUser">
            <q-input
              v-model="createForm.firstname"
              label="First Name"
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />
            <q-input
              v-model="createForm.lastname"
              label="Last Name"
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />
            <q-input
              v-model="createForm.email"
              label="Email"
              type="email"
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />
            <q-input
              v-model="createForm.telephone"
              label="Telephone"
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />
            <q-input
              v-model="createForm.address"
              label="Address"
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />
            <q-input
              v-model="createForm.dob"
              label="Date of Birth"
              type="date"
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <q-select
              v-model="createForm.country_code"
              :options="countries"
              label="Country"
              option-label="name"
              option-value="code"
              emit-value
              map-options
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- Province Select -->
            <q-select
              v-model="createForm.province_code"
              :options="provinces"
              label="Province"
              option-label="name"
              option-value="province_code"
              emit-value
              map-options
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- DPC Select -->
            <q-select
              v-model="createForm.dpc_id"
              :options="dpcs"
              label="DPC"
              option-label="dpcname"
              option-value="dpccode"
              emit-value
              map-options
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- Role Select -->
            <q-select
              v-model="createForm.role"
              :options="roles"
              label="Role"
              option-label="name"
              option-value="name"
              emit-value
              map-options
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- Password -->
            <q-input
              v-model="createForm.password"
              label="Password"
              type="password"
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- Confirm Password -->
            <q-input
              v-model="createForm.confirmPassword"
              label="Repeat Password"
              type="password"
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <q-btn
              label="Create User"
              type="submit"
              color="primary"
              :disable="!isSuperAdmin"
              class="q-mt-md"
            />
          </q-form>
        </q-tab-panel>

        <!-- Edit Profile Panel -->
        <q-tab-panel name="edit">
          <!-- Super Admin Table -->
          <div v-if="isSuperAdmin" class="q-mb-md">
            <q-card flat bordered class="q-pa-sm">
              <div class="text-h6 q-mb-md">Manage Users</div>

              <q-table
                :rows="allUsers"
                :columns="columns"
                row-key="userid"
                flat
                bordered
                dense
                @row-click="loadUserToEdit"
              >
                <template v-slot:top-right>
                  <q-btn label="Reload Users" color="primary" dense flat @click="loadAllUsers" />
                </template>

                <template v-slot:body="props">
                  <q-tr :props="props" class="cursor-pointer hover:bg-grey-2">
                    <q-td>{{ props.row.firstname }} {{ props.row.lastname }}</q-td>
                    <q-td>{{ props.row.role }}</q-td>
                    <q-td>{{ props.row.dpc_id }}</q-td>
                    <q-td>{{ props.row.email }}</q-td>
                    <q-td>
                      <q-btn
                        dense
                        flat
                        color="primary"
                        label="Edit"
                        @click.stop="loadUserToEdit(props.row)"
                      />
                    </q-td>
                  </q-tr>
                </template>
              </q-table>
            </q-card>
          </div>

          <!-- Profile Edit Form -->
          <q-form @submit.prevent="updateProfile">
            <!-- Basic Info -->
            <q-input v-model="editForm.firstname" label="First Name" class="q-mb-sm" />
            <q-input v-model="editForm.lastname" label="Last Name" class="q-mb-sm" />
            <q-input v-model="editForm.email" label="Email" disable class="q-mb-sm" />
            <q-input v-model="editForm.telephone" label="Telephone" class="q-mb-sm" />
            <q-input v-model="editForm.address" label="Address" class="q-mb-sm" />
            <q-input v-model="editForm.dob" label="Date of Birth" type="date" class="q-mb-sm" />

            <!-- Country -->
            <q-select
              v-model="editForm.country_code"
              :options="countries"
              label="Country"
              option-label="name"
              option-value="code"
              emit-value
              map-options
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- Province -->
            <q-select
              v-model="editForm.province_code"
              :options="provinces"
              label="Province"
              option-label="name"
              option-value="province_code"
              emit-value
              map-options
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- DPC -->
            <q-select
              v-model="editForm.dpc_id"
              :options="dpcs"
              label="DPC"
              option-label="dpcname"
              option-value="dpccode"
              emit-value
              map-options
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- Role -->
            <q-select
              v-model="editForm.role"
              :options="roles"
              label="Role"
              option-label="name"
              option-value="name"
              emit-value
              map-options
              :disable="!isSuperAdmin"
              class="q-mb-sm"
            />

            <!-- Password (only visible if user edits own profile) -->
            <!-- Password Section -->
            <!-- Visible when:
  - Regular user edits own profile
  - OR SuperAdmin edits their own profile (no selected user OR selectedUser is self)
-->
            <div
              v-if="
                !isSuperAdmin ||
                (isSuperAdmin && (!selectedUser || selectedUser.userid === auth.user.id))
              "
            >
              <q-input
                v-model="editForm.newPassword"
                label="New Password"
                type="password"
                class="q-mb-sm"
              />
              <q-input
                v-model="editForm.confirmPassword"
                label="Confirm Password"
                type="password"
                class="q-mb-sm"
              />
            </div>

            <!-- Submit -->
            <q-btn label="Update Profile" type="submit" color="primary" class="q-mt-md" />

            <!-- Delete button (SuperAdmin only, and not for self) -->
            <q-btn
              v-if="isSuperAdmin && selectedUser?.userid !== auth.user.id"
              label="Delete User"
              color="negative"
              icon="delete"
              class="q-mt-md q-ml-sm"
              @click="confirmDeleteUser(selectedUser.userid)"
            />
          </q-form>
        </q-tab-panel>
      </q-tab-panels>
    </q-card>
  </q-page>
</template>

<script setup>
// Profile, authentication, and reference-data dependencies.
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useAuth } from 'stores/auth'
import { supabase } from 'boot/supabase'
import { useI18n } from 'vue-i18n'
// Active user, role checks, lookup data, and profile forms.
const { t: $t } = useI18n()
const $q = useQuasar()
const router = useRouter()
const auth = useAuth()
const columns = [
  {
    name: 'name',
    label: 'Name',
    field: (row) => `${row.firstname} ${row.lastname}`,
    align: 'left',
  },
  { name: 'role', label: 'Role', field: 'role', align: 'left' },
  { name: 'dpc_id', label: 'DPC', field: 'dpc_id', align: 'left' },
  { name: 'email', label: 'Email', field: 'email', align: 'left' },
  { name: 'actions', label: 'Actions', field: 'actions', align: 'center' },
]

const tab = ref('create')
const countries = ref([])
const provinces = ref([])
const dpcs = ref([])
const roles = ref([])
const allUsers = ref([])
const selectedUser = ref(null)

// ------------------- COMPUTED -------------------
const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')
const isAdmin = computed(() => auth.userDetails?.role === 'Admin')
// ------------------- FORMS -------------------
const createForm = ref({
  firstname: '',
  lastname: '',
  email: '',
  telephone: '',
  address: '',
  dob: '',
  country_code: '',
  province_code: '',
  dpc_id: '',
  role: '',
  password: '',
  confirmPassword: '',
})

const editForm = ref({
  firstname: '',
  lastname: '',
  email: '',
  telephone: '',
  address: '',
  dob: '',
  country_code: '',
  province_code: '',
  dpc_id: '',
  role: '',
  newPassword: '',
  confirmPassword: '',
})

//- DATA LOADERS -------------------
async function loadCountries() {
  try {
    const { data, error } = await supabase.from('country').select('code, name')
    if (error) throw error
    countries.value = data || []
  } catch (err) {
    console.error('Error loading countries:', err)
    $q.notify({ type: 'negative', message: 'Failed to load countries' })
  }
}

async function loadProvinces(countryCode) {
  try {
    if (!countryCode) {
      provinces.value = []
      dpcs.value = []
      return
    }
    const { data, error } = await supabase
      .from('province')
      .select('province_code, name')
      .eq('country_code', countryCode)
    if (error) throw error
    provinces.value = data || []
    dpcs.value = []
  } catch (err) {
    console.error('Error loading provinces:', err)
    $q.notify({ type: 'negative', message: 'Failed to load provinces' })
  }
}

async function loadDPCs(provinceCode) {
  try {
    if (!provinceCode) {
      dpcs.value = []
      return
    }

    let query = supabase.from('dpc').select('dpccode, dpcname')

    if (isSuperAdmin.value) {
      query = query.eq('province', provinceCode)
    } else if (isAdmin.value) {
      // Admin: restrict to their own province regardless of dropdown
      const userProvince = auth.userDetails?.province_code
      query = query.eq('province', userProvince)
    } else {
      // Regular user: see only their DPC
      const userDPC = auth.userDetails?.dpc_id
      query = query.eq('dpccode', userDPC)
    }

    const { data, error } = await query.order('dpcname')
    if (error) throw error
    dpcs.value = data || []
  } catch (err) {
    console.error('Error loading DPCs:', err)
    $q.notify({ type: 'negative', message: 'Failed to load DPCs' })
  }
}
async function loadRoles() {
  try {
    const { data, error } = await supabase.from('roles').select('name')
    if (error) throw error
    roles.value = data || []
  } catch (err) {
    console.error('Error loading roles:', err)
    $q.notify({ type: 'negative', message: 'Failed to load roles' })
  }
}

async function loadAllUsers() {
  const { data, error } = await supabase.from('shopusers').select('*').order('firstname')
  if (!error) allUsers.value = data
}

// ------------------- WATCHERS -------------------
// ------------------- WATCHERS -------------------
watch(() => createForm.value.country_code, loadProvinces)
watch(() => createForm.value.province_code, loadDPCs)
watch(() => editForm.value.country_code, loadProvinces)
watch(() => editForm.value.province_code, loadDPCs)

const logoutAndRedirect = async () => {
  await auth.logout() // calls Pinia logout, clears session
  window.location.href = '/' // redirect to login page
}
// Load the signed-in profile and its country, province, and DPC options.
onMounted(async () => {
  try {
    const user = auth.user
    if (!user) return
    if (isSuperAdmin.value) loadAllUsers()

    await Promise.all([loadCountries(), loadRoles()])

    const { data, error } = await supabase
      .from('shopusers')
      .select('*')
      .eq('userid', user.id)
      .single()
    if (error) throw error

    editForm.value = { ...data, newPassword: '', confirmPassword: '' }

    if (editForm.value.country_code) await loadProvinces(editForm.value.country_code)
    if (editForm.value.province_code) await loadDPCs(editForm.value.province_code)
  } catch (err) {
    $q.notify({ type: 'negative', message: 'Failed to load profile: ' + err.message })
  }
})
// Computed
//const isSuperAdmin = computed(() => auth.userDetails?.role === 'SuperAdmin')

// Navigation
const goBack = () => router.push('/')

async function createUser() {
  if (createForm.value.password !== createForm.value.confirmPassword) {
    $q.notify({ type: 'negative', message: 'Passwords do not match' })
    return
  }

  try {
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: createForm.value.email,
      password: createForm.value.password,
    })
    if (authError) throw authError

    const userId = authData.user.id

    // Insert into shopusers
    const { error } = await supabase.from('shopusers').insert([
      {
        userid: userId,
        firstname: createForm.value.firstname,
        lastname: createForm.value.lastname,
        email: createForm.value.email,
        telephone: createForm.value.telephone,
        address: createForm.value.address,
        dob: createForm.value.dob,
        country_code: createForm.value.country_code,
        province_code: createForm.value.province_code,
        dpc_id: createForm.value.dpc_id,
        role: createForm.value.role,
      },
    ])
    if (error) throw error

    $q.notify({ type: 'positive', message: 'User created successfully!' })
    resetForm()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  }
}

function resetForm() {
  createForm.value = {
    firstname: '',
    lastname: '',
    email: '',
    telephone: '',
    address: '',
    dob: '',
    country_code: '',
    province_code: '',
    dpc_id: '',
    role: '',
    password: '',
  }
}

const updateProfile = async () => {
  try {
    const currentUserId = auth.user?.id
    if (!currentUserId) throw new Error('No logged-in user.')

    const targetUserId =
      isSuperAdmin.value && selectedUser.value
        ? selectedUser.value.userid // SuperAdmin editing another user
        : currentUserId // Editing self

    // 1️⃣ Update general user info
    const { error: updateError } = await supabase
      .from('shopusers')
      .update({
        firstname: editForm.value.firstname,
        lastname: editForm.value.lastname,
        telephone: editForm.value.telephone,
        address: editForm.value.address,
        dob: editForm.value.dob,
        country_code: editForm.value.country_code,
        province_code: editForm.value.province_code,
        dpc_id: editForm.value.dpc_id,
        role: editForm.value.role,
      })
      .eq('userid', targetUserId)

    if (updateError) throw updateError

    // 2️⃣ Determine if editing own profile
    const isEditingSelf = targetUserId === currentUserId

    // 3️⃣ Handle password change — only for self
    if (isEditingSelf && editForm.value.newPassword) {
      if (editForm.value.newPassword !== editForm.value.confirmPassword) {
        $q.notify({ type: 'negative', message: 'Passwords do not match.' })
        return
      }

      // Use auth store method to update password
      await auth.updatePassword(editForm.value.newPassword)

      $q.notify({
        type: 'positive',
        message: 'Password changed successfully. You will be logged out.',
      })

      await logoutAndRedirect()
      return
    }

    // 4️⃣ Notifications
    if (isSuperAdmin.value && selectedUser.value && !isEditingSelf) {
      // SuperAdmin updated another user
      $q.notify({
        type: 'positive',
        message: `User ${editForm.value.firstname} ${editForm.value.lastname} updated successfully.`,
      })
      await loadAllUsers()
    } else {
      // Self update (info only)
      $q.notify({
        type: 'positive',
        message: $t('profileUpdatedLogout'),
      })
      setTimeout(async () => {
        await logoutAndRedirect()
      }, 2000)
    }
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  }
}
const confirmDeleteUser = (userId) => {
  $q.dialog({
    title: 'Confirm Delete',
    message: 'Are you sure you want to delete this user? This action cannot be undone.',
    cancel: true,
    persistent: true,
  }).onOk(() => deleteUser(userId))
}

const deleteUser = async (userId) => {
  try {
    const { error } = await supabase.from('shopusers').delete().eq('userid', userId)
    if (error) throw error

    $q.notify({
      type: 'positive',
      message: 'User deleted successfully.',
    })

    await loadAllUsers()
  } catch (err) {
    $q.notify({ type: 'negative', message: err.message })
  }
}

// when a row is clicked
function loadUserToEdit(user) {
  selectedUser.value = user
  editForm.value = {
    ...editForm.value,
    ...user,
    newPassword: '',
    confirmPassword: '',
  }
  $q.notify({
    type: 'info',
    message: `Loaded ${user.firstname} ${user.lastname} for editing`,
  })
}
</script>

<style scoped>
.q-page {
  max-width: 600px;
  margin: 0 auto;
}
</style>

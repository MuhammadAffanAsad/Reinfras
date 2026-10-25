const SERVER_URL = window.SERVER_URL || "https://behavioral-building-audit-nottingham.trycloudflare.com";

// FITUR LOKASI SAYA SAAT INI & IZIN LOKASI
const btnLokasiSaya = document.getElementById('btn-lokasi-saya');
const namaLokasiEl = document.getElementById('nama-lokasi');
const koorLokasiEl = document.getElementById('koordinat-lokasi');
const latitudeEl = document.getElementById('latitude');
const longitudeEl = document.getElementById('longitude');

function executeGetLocation() {
    if (!navigator.geolocation) {
        console.warn('Fitur lokasi tidak didukung oleh peramban Anda.');
        if (koorLokasiEl) koorLokasiEl.textContent = 'Fitur lokasi tidak didukung';
        return;
    }

    if (koorLokasiEl) {
        koorLokasiEl.textContent = 'Mendapatkan lokasi saat ini...';
    }

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;

            window.koordinat = [lat, lng];
            if (latitudeEl) latitudeEl.value = lat;
            if (longitudeEl) longitudeEl.value = lng;

            if (koorLokasiEl) {
                koorLokasiEl.textContent = `Lintang: ${lat}, Bujur: ${lng}`;
            }

            // Update peta jika variabel map tersedia
            if (window.map) {
                window.map.setView([lat, lng], 16);
                if (!window.currentLocationMarker) {
                    window.currentLocationMarker = L.marker([lat, lng]).addTo(window.map);
                } else {
                    window.currentLocationMarker.setLatLng([lat, lng]);
                }
            }

            // Ambil alamat via reverse geocoding
            try {
                const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&accept-language=id`);
                const data = await res.json();
                
                const addressDetails = [
                    data.display_name,
                    data.address?.road,
                    data.address?.suburb,
                    data.address?.city_district
                ].filter(Boolean);

                window.alamat = addressDetails.length > 0 ? addressDetails : [data.display_name || `${lat}, ${lng}`];
                
                if (namaLokasiEl) {
                    namaLokasiEl.textContent = data.display_name || `Lokasi (${lat}, ${lng})`;
                }
            } catch (err) {
                console.error('Gagal mengambil alamat:', err);
                window.alamat = [`${lat}, ${lng}`];
                if (namaLokasiEl) {
                    namaLokasiEl.textContent = `Lokasi (${lat}, ${lng})`;
                }
            }
        },
        (error) => {
            console.error('Gagal mendapatkan posisi:', error);
            if (koorLokasiEl) {
                if (error.code === error.PERMISSION_DENIED) {
                    koorLokasiEl.textContent = 'Izin lokasi ditolak';
                } else {
                    koorLokasiEl.textContent = 'Gagal mengambil lokasi';
                }
            }
        },
        {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 0
        }
    );
}

if (btnLokasiSaya) {
    btnLokasiSaya.addEventListener('click', executeGetLocation);
}

// STATUS MODAL (LOADING, SUCCESS, & ERROR)
const statusModal = document.getElementById('statusModal');
const statusModalLoading = document.getElementById('statusModalLoading');
const statusModalSuccess = document.getElementById('statusModalSuccess');
const statusModalError = document.getElementById('statusModalError');
const statusModalErrorText = document.getElementById('statusModalErrorText');
const submitButton = document.getElementById('submit-button');
let isSubmitting = false;

function showStatusModal(type, errorMessage = '') {
    if (!statusModal) return;
    document.body.style.overflow = 'hidden';
    statusModal.classList.remove('hidden');
    statusModal.classList.add('flex');

    if (statusModalLoading) { statusModalLoading.classList.add('hidden'); statusModalLoading.classList.remove('flex'); }
    if (statusModalSuccess) { statusModalSuccess.classList.add('hidden'); statusModalSuccess.classList.remove('flex'); }
    if (statusModalError) { statusModalError.classList.add('hidden'); statusModalError.classList.remove('flex'); }

    if (type === 'loading') {
        if (statusModalLoading) {
            statusModalLoading.classList.remove('hidden');
            statusModalLoading.classList.add('flex');
        }
    } else if (type === 'success') {
        if (statusModalSuccess) {
            statusModalSuccess.classList.remove('hidden');
            statusModalSuccess.classList.add('flex');
        }
    } else if (type === 'error') {
        if (statusModalError) {
            statusModalError.classList.remove('hidden');
            statusModalError.classList.add('flex');
        }
        if (statusModalErrorText && errorMessage) {
            statusModalErrorText.textContent = errorMessage;
        }
    }
}

function hideStatusModal() {
    if (!statusModal) return;
    document.body.style.overflow = '';
    statusModal.classList.add('hidden');
    statusModal.classList.remove('flex');
    isSubmitting = false;
    if (submitButton) {
        submitButton.disabled = false;
        submitButton.classList.remove('opacity-50', 'cursor-not-allowed');
    }
}
window.hideStatusModal = hideStatusModal;

// SUBMIT BUTTON
document.getElementById('reportForm').addEventListener('submit', async function(event) {
    event.preventDefault();
    
    if (isSubmitting) return;
    isSubmitting = true;

    if (submitButton) {
        submitButton.disabled = true;
        submitButton.classList.add('opacity-50', 'cursor-not-allowed');
    }

    const namaPelapor = document.getElementById("namaPelapor").value;
    const judulLaporan = document.getElementById("judulLaporan").value;
    const fotoInput = document.getElementById("foto");
    const kategori = document.getElementById("kategori").value;
    const keterangan = document.getElementById("keterangan").value;

    let fotoFile = fotoInput.files[0];

    const formData = new FormData();

    formData.append("namaPelapor", namaPelapor);
    formData.append("judulLaporan", judulLaporan);
    if (fotoFile) {
        formData.append("foto", fotoFile, fotoInput.files[0].name);
    }
    formData.append("alamat", window.alamat || "");
    formData.append("koordinat", window.koordinat || "");
    formData.append("kategori", kategori);
    formData.append("keterangan", keterangan);
    formData.append("dox", window.dox || "");

    showStatusModal('loading');

    try {
        const response = await fetch(SERVER_URL, {
            method: 'POST',
            body: formData
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(result.pesan || 'Gagal mengirim laporan');
        }
        showStatusModal('success');
        setTimeout(() => {
            location.reload();
        }, 1500);
    } catch (err) {
        console.error('Gagal mengirim laporan:', err);
        showStatusModal('error', err.message || 'Gagal mengirim laporan. Periksa koneksi Anda dan coba lagi.');
    }
});

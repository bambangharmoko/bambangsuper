-- Rename enum values for service_status
ALTER TYPE public.service_status RENAME VALUE 'Menunggu Konfirmasi' TO 'Menunggu Persetujuan Pelanggan';
ALTER TYPE public.service_status RENAME VALUE 'Pending' TO 'Menunggu Sparepart';

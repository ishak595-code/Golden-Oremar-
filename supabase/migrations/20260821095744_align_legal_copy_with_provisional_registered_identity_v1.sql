update public.brand_settings
set public_config=jsonb_set(
      coalesce(public_config,'{}'::jsonb),
      '{launchReadiness}',
      jsonb_build_object(
        'status','blocked_pending_registered_identity_verification_and_external_release_inputs',
        'reason','Golden Oremar başlangıç işletme kimliği ve iletişim bilgileri dolduruldu. Production ticari açılış için tescilli unvan/adres resmi kayıtla Super Admin üzerinden doğrulanmalı; sağlayıcı credential, gerçek HTTPS origin ve mağaza signing gibi dış release girdileri ayrıca tamamlanmalıdır.'
      ),
      true
    ),
    updated_at=timezone('utc',now())
where slug='golden-oremar';

update public.content_entries
set body_markdown=case slug
  when 'about' then replace(body_markdown,
    'Açık ticari/tebligat adresi ile tüzel kişilik, vergi ve sicil bilgileri kesinleştiğinde yasal kimlik alanlarına ayrıca işlenecektir. Bu bilgiler kesinleşmeden gerçeğe aykırı bir şirket kaydı yayınlanmaz.',
    'Golden Oremar için başlangıç işletme kimliği yönetim sisteminde tanımlıdır. Tescilli ticari unvan, açık adres ve varsa vergi/sicil bilgileri resmi kayıtlarla Super Admin üzerinden doğrulanıp güncellenir. Doğrulama tamamlanmadan gerçeğe aykırı bir kayıt yayınlanmaz.')
  when 'privacy' then replace(replace(body_markdown,
    'Golden Oremar''ın kesin tüzel kişilik/ticari unvanı ve açık ticari/tebligat adresi henüz tescil bilgileriyle kesinleştirilmediği için production kullanıcı edinimi ve ticari açılış, bu kimlik bilgileri tamamlanmadan hukuki uyum bakımından hazır kabul edilmez.',
    'Golden Oremar için başlangıç işletme kimliği sistemde tanımlıdır. Production kullanıcı edinimi ve ticari açılış, kesin veri sorumlusu ticari unvanı ile açık ticari/tebligat adresi resmi kayıtlarla Super Admin üzerinden doğrulanmadan hukuki uyum bakımından hazır kabul edilmez.'),
    'Kesin veri sorumlusu ticari kimliği, ticaret/vergi kayıtları ve açık adres tescil edildiğinde bu bölüm yayından önce güncellenecektir. Gerçekte mevcut olmayan şirket, vergi veya sicil bilgisi yazılmaz.',
    'Kesin veri sorumlusu ticari kimliği, ticaret/vergi kayıtları ve açık adres resmi kayıtlarla doğrulandığında bu bölüm Super Admin üzerinden güncellenecektir. Gerçekte mevcut olmayan şirket, vergi veya sicil bilgisi yazılmaz.')
  when 'returns' then replace(body_markdown,
    'Golden Oremar''ın kesin tüzel kişilik/ticari unvanı ve açık ticari/tebligat adresi tescil edilmeden production mesafeli satış açılışı tamamlanmış kabul edilmez.',
    'Golden Oremar''ın kesin ticari unvanı ve açık ticari/tebligat adresi resmi kayıtlarla Super Admin üzerinden doğrulanmadan production mesafeli satış açılışı tamamlanmış kabul edilmez.')
  when 'terms' then replace(replace(body_markdown,
    'Açık ticari/tebligat adresi ile kesin tüzel kişilik, vergi ve sicil bilgileri kuruluş/tescil süreci tamamlandığında yasal kimlik alanlarına eklenecektir. Gerçekte mevcut olmayan kayıt bilgileri yayınlanmaz.',
    'Başlangıç işletme kimliği yönetim sisteminde tanımlıdır. Kesin ticari unvan, açık ticari/tebligat adresi ve varsa vergi/sicil bilgileri resmi kayıtlarla Super Admin üzerinden doğrulanıp güncellenir. Gerçekte mevcut olmayan kayıt bilgileri yayınlanmaz.'),
    'Golden Oremar''ın kesin tüzel kişilik/ticari unvanı ve açık ticari/tebligat adresi tescil edilmeden bu kapı tamamlanmış sayılmaz.',
    'Golden Oremar''ın kesin ticari unvanı ve açık ticari/tebligat adresi resmi kayıtlarla Super Admin üzerinden doğrulanmadan bu kapı tamamlanmış sayılmaz.')
  else body_markdown end,
  updated_at=timezone('utc',now()),
  metadata=coalesce(metadata,'{}'::jsonb)||jsonb_build_object('identityWordingAlignedAt','2026-08-21','identityModel','provisional_until_super_admin_verification')
where content_type='legal' and locale='tr' and slug in('about','privacy','returns','terms') and deleted_at is null;

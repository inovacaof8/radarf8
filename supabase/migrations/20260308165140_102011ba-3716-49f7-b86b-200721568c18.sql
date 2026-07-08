ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_profiles_fkey FOREIGN KEY (user_id) REFERENCES public.profiles(user_id) ON DELETE CASCADE; INSERT INTO public.legal_document_versions (document_id, version, content, requires_acceptance, published_by) SELECT 'd0000000-0000-0000-0000-000000000003', 1, 'Política de Cookies

1. O que são Cookies: Cookies são pequenos arquivos de texto armazenados no seu navegador para melhorar sua experiência.

2. Cookies Utilizados: Utilizamos cookies essenciais para autenticação e funcionamento da plataforma.

3. Cookies de Sessão: São temporários e removidos ao fechar o navegador.

4. Gerenciamento: Você pode configurar seu navegador para recusar cookies, mas isso pode afetar funcionalidades do sistema.

5. Consentimento: Ao utilizar a plataforma, você consente com o uso dos cookies descritos nesta política.', true, 'Sistema' WHERE NOT EXISTS (SELECT 1 FROM public.legal_document_versions WHERE document_id = 'd0000000-0000-0000-0000-000000000003');
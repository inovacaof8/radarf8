GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting TO authenticated;
GRANT ALL ON public.meeting TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_participant TO authenticated;
GRANT ALL ON public.meeting_participant TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_action_item TO authenticated;
GRANT ALL ON public.meeting_action_item TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meeting_minute TO authenticated;
GRANT ALL ON public.meeting_minute TO service_role;
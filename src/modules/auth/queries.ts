import { createClient, isSupabaseConfigured } from "@/lib/supabase/server";

export type PerfilActual = {
	id: string;
	comercioId: string;
	rol: "dueno" | "encargado" | "cajero";
};

type PerfilRow = {
	id: string;
	comercio_id: string;
	rol: PerfilActual["rol"];
};

export async function getPerfilActual(): Promise<PerfilActual | null> {
	if (!isSupabaseConfigured()) {
		return null;
	}

	const supabase = await createClient();
	const {
		data: { user },
		error: authError,
	} = await supabase.auth.getUser();

	if (authError || !user) {
		return null;
	}

	const { data, error } = await supabase
		.from("perfiles")
		.select("id, comercio_id, rol")
		.eq("id", user.id)
		.eq("activo", true)
		.maybeSingle()
		.overrideTypes<PerfilRow | null>();

	if (error || !data) {
		return null;
	}

	return {
		id: data.id,
		comercioId: data.comercio_id,
		rol: data.rol,
	};
}

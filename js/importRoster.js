import { supabase } from "./supabaseClient.js";
import { readStaffAccessContext } from "./db.js?v=1.28";

function makeUsername(firstName, surname, misId) {
  const f = (firstName || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const s = (surname || "").trim().toLowerCase().replace(/[^a-z0-9]/g, "");
  const idPart = String(misId || "").trim().slice(-4);
  return `${(f[0] || "p")}${s}${idPart}`.slice(0, 24);
}

export async function importRoster(rows, classId) {
  if (!classId) throw new Error("Class ID is required.");

  const accessContext = await readStaffAccessContext();
  if (!accessContext?.capabilities?.can_import_csv) {
    throw new Error("Admin access is required to import a roster.");
  }

  for (const r of rows) {
    const misId = String(r.mis_id || "").trim();
    const firstName = String(r.first_name || "").trim();
    const surname = String(r.surname || "").trim();

    if (!misId || !firstName || !surname) {
      throw new Error("Each CSV row must include mis_id, first_name and surname.");
    }

    const username = makeUsername(firstName, surname, misId);

    const { data: existingPupil, error: existingError } = await supabase
      .from("pupils")
      .select("id, mis_id, username")
      .eq("mis_id", misId)
      .maybeSingle();

    if (existingError) {
      throw new Error(`Could not check existing pupil (${misId}): ${existingError.message}`);
    }

    let pupil = existingPupil;

    if (!pupil) {
      const { data: insertedPupil, error: insertError } = await supabase
        .from("pupils")
        .insert({
          mis_id: misId,
          first_name: firstName,
          surname,
          username,
          pin: "1234",
          must_reset_pin: true,
          is_active: true
        })
        .select("id, mis_id, username")
        .single();

      if (insertError) {
        throw new Error(`Could not create pupil ${firstName} ${surname} (${misId}): ${insertError.message}`);
      }

      pupil = insertedPupil;
    }

    const { data: existingMembership, error: membershipCheckError } = await supabase
      .from("pupil_classes")
      .select("id")
      .eq("pupil_id", pupil.id)
      .eq("class_id", classId)
      .maybeSingle();

    if (membershipCheckError) {
      throw new Error(`Could not check class membership for ${pupil.username}: ${membershipCheckError.message}`);
    }

    if (!existingMembership) {
      const { error: membershipInsertError } = await supabase
        .from("pupil_classes")
        .insert({
          pupil_id: pupil.id,
          class_id: classId,
          active: true
        });

      if (membershipInsertError) {
        throw new Error(`Could not add ${pupil.username} to class: ${membershipInsertError.message}`);
      }
    }
  }

  return true;
}

import { genSaltSync, hashSync } from "bcrypt-ts";
import { generateUUID } from "@/shared/utils";

export function generateHashedPassword(password: string) {
  const salt = genSaltSync(10);
  const hash = hashSync(password, salt);

  return hash;
}

export function generateDummyPassword() {
  const password = generateUUID();
  const hashedPassword = generateHashedPassword(password);

  return hashedPassword;
}

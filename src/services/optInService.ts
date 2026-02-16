import { userOptInRepo } from "../db/repositories/userOptInRepo.ts";

export const optInService = {
  setOptIn: userOptInRepo.setOptIn,
  isOptedIn: userOptInRepo.isOptedIn
};

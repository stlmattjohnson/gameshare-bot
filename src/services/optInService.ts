import { userOptInRepo } from "../db/repositories/userOptInRepo.js";

export const optInService = {
  setOptIn: userOptInRepo.setOptIn,
  isOptedIn: userOptInRepo.isOptedIn
};

import { ActivityDetails } from "@prisma/client";

export type ActivityType = "EXTENSION" | "COURSE" | "EVENT" | "LECTURE" | "OTHER";

export type CampusLocation = "MACEIO" | "ARAPIRACA" | "PALMEIRA" | "PENEDO" | "RIO_LARGO" | "DELMIRO_GOUVEIA" | "SANTANA_IPANEMA";

export type ActivityStatus = "OPEN" | "IN_PROGRESS" | "COMPLETED" | "CANCELLED";

export type activityResponse = {
  "id": string,
  "authorId": string,
  "title": string,
  "type": ActivityType,
  "campus": CampusLocation,
  "startDate": Date,
  "endDate": Date,
  "slots": number,
  "status": ActivityStatus
}
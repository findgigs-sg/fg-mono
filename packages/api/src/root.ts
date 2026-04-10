import { authRouter } from "./router/auth";
import { postRouter } from "./router/post";
import { profileRouter } from "./router/profile";
import { storageRouter } from "./router/storage";
import { venueRouter } from "./router/venue";
import { createTRPCRouter } from "./trpc";

export const appRouter = createTRPCRouter({
  auth: authRouter,
  post: postRouter,
  profile: profileRouter,
  storage: storageRouter,
  venue: venueRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

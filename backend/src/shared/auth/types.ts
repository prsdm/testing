export type SessionUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  image?: string | null;
  type: "regular";
};

export type AppSession = {
  user: SessionUser;
};

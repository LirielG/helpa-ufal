export type RenderedEmail = {
  subject: string;
  text: string;
  html: string;
};

export interface IEmailTemplate<Vars> {
  render(vars: Vars): RenderedEmail;
}

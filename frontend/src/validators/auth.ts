export interface ValidationError {
  field: string;
  message: string;
}

export const validateEmail = (email: string): string | null => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!email) return "E-mail é obrigatório";
  if (!emailRegex.test(email)) return "E-mail inválido";
  return null;
};

export const validatePassword = (password: string): string | null => {
  if (!password) return "Senha é obrigatória";
  if (password.length < 6) return "Senha deve ter no mínimo 6 caracteres";
  if (password.length > 128) return "Senha deve ter no máximo 128 caracteres";
  return null;
};

export const validateName = (name: string): string | null => {
  if (!name) return "Nome é obrigatório";
  if (name.length < 3) return "Nome deve ter no mínimo 3 caracteres";
  if (name.length > 255) return "Nome deve ter no máximo 255 caracteres";
  return null;
};

export const validatePasswordConfirmation = (
  password: string,
  confirmPassword: string
): string | null => {
  if (password !== confirmPassword) return "As senhas não correspondem";
  return null;
};

export const validateInstitution = (institution: string): string | null => {
  if (!institution) return "Instituição é obrigatória";
  return null;
};

export const validateCourse = (course: string): string | null => {
  if (!course) return "Curso é obrigatório";
  return null;
};

export const validateEnrollment = (enrollment: string): string | null => {
  if (!enrollment) return "Matrícula é obrigatória";
  return null;
};

export const validateCNDB = (cndb: string): string | null => {
  if (!cndb) return "CNDB é obrigatório";
  return null;
};

export const validateLoginForm = (email: string, password: string) => {
  const errors: ValidationError[] = [];

  const emailError = validateEmail(email);
  if (emailError) errors.push({ field: "email", message: emailError });

  const passwordError = validatePassword(password);
  if (passwordError) errors.push({ field: "password", message: passwordError });

  return errors;
};

export const validateRegisterForm = (formData: {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  institution?: string;
  cndbNumber?: string;
  course?: string;
  enrollment?: string;
  userType: string;
}) => {
  const errors: ValidationError[] = [];

  const nameError = validateName(formData.name);
  if (nameError) errors.push({ field: "name", message: nameError });

  const emailError = validateEmail(formData.email);
  if (emailError) errors.push({ field: "email", message: emailError });

  const passwordError = validatePassword(formData.password);
  if (passwordError) errors.push({ field: "password", message: passwordError });

  const confirmError = validatePasswordConfirmation(
    formData.password,
    formData.confirmPassword
  );
  if (confirmError)
    errors.push({ field: "confirmPassword", message: confirmError });

  if (formData.userType === "student") {
    const institutionError = validateInstitution(formData.institution || "");
    if (institutionError)
      errors.push({ field: "institution", message: institutionError });

    const courseError = validateCourse(formData.course || "");
    if (courseError) errors.push({ field: "course", message: courseError });

    const enrollmentError = validateEnrollment(formData.enrollment || "");
    if (enrollmentError)
      errors.push({ field: "enrollment", message: enrollmentError });
  }

  if (formData.userType === "teacher") {
    const institutionError = validateInstitution(formData.institution || "");
    if (institutionError)
      errors.push({ field: "institution", message: institutionError });

    const cndbError = validateCNDB(formData.cndbNumber || "");
    if (cndbError)
      errors.push({ field: "cndbNumber", message: cndbError });
  }

  return errors;
};

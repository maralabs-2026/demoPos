import { describe, expect, it } from "vitest";
import { changePasswordSchema, loginSchema } from "./schemas";

describe("loginSchema", () => {
  it("normalizes email (trim + lowercase) and preserves password as-is", () => {
    const result = loginSchema.safeParse({
      email: "  Juan.Perez@KioskoDemo.COM ",
      password: "  secreta  ",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe("juan.perez@kioskodemo.com");
      expect(result.data.password).toBe("  secreta  ");
    }
  });

  it("accepts a plain valid email and password", () => {
    const result = loginSchema.safeParse({
      email: "juan@kioskodemo.com",
      password: "abc123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects an empty or whitespace-only email", () => {
    for (const email of ["", "   "]) {
      const result = loginSchema.safeParse({ email, password: "abc123" });
      expect(result.success).toBe(false);
    }
  });

  it("flags an empty email as required", () => {
    const result = loginSchema.safeParse({ email: "", password: "abc123" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.message)).toContain(
        "El correo es obligatorio",
      );
    }
  });

  it("rejects an email without a valid format", () => {
    const result = loginSchema.safeParse({ email: "no-es-un-correo", password: "abc123" });
    expect(result.success).toBe(false);
  });

  it("rejects an email longer than 254 characters", () => {
    const result = loginSchema.safeParse({ email: `${"a".repeat(250)}@b.com`, password: "abc123" });
    expect(result.success).toBe(false);
  });

  it("rejects a password longer than 128 characters", () => {
    const result = loginSchema.safeParse({ email: "juan@kioskodemo.com", password: "a".repeat(129) });
    expect(result.success).toBe(false);
  });

  it("accepts a password of up to 128 characters", () => {
    const result = loginSchema.safeParse({ email: "juan@kioskodemo.com", password: "a".repeat(128) });
    expect(result.success).toBe(true);
  });

  it("rejects when email or password is missing", () => {
    expect(loginSchema.safeParse({ password: "abc123" }).success).toBe(false);
    expect(loginSchema.safeParse({ email: "juan@kioskodemo.com" }).success).toBe(false);
  });

  it("rejects an empty password", () => {
    const result = loginSchema.safeParse({ email: "juan@kioskodemo.com", password: "" });
    expect(result.success).toBe(false);
  });
});

describe("changePasswordSchema", () => {
  it("accepts matching passwords", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "nueva123",
      confirmPassword: "nueva123",
    });

    expect(result.success).toBe(true);
  });

  it("rejects when passwords do not match and flags confirmPassword", () => {
    const result = changePasswordSchema.safeParse({
      newPassword: "nueva123",
      confirmPassword: "otra123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((issue) => issue.path[0])).toContain("confirmPassword");
    }
  });

  it("rejects passwords longer than 128 characters", () => {
    const password = "a".repeat(129);
    const result = changePasswordSchema.safeParse({ newPassword: password, confirmPassword: password });
    expect(result.success).toBe(false);
  });

  it("rejects when a field is missing", () => {
    expect(changePasswordSchema.safeParse({ newPassword: "abc123" }).success).toBe(false);
    expect(changePasswordSchema.safeParse({ confirmPassword: "abc123" }).success).toBe(false);
  });

  it("rejects empty new and confirm passwords", () => {
    const result = changePasswordSchema.safeParse({ newPassword: "", confirmPassword: "" });
    expect(result.success).toBe(false);
  });
});

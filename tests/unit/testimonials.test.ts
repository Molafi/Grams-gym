import { describe, expect, it } from "vitest";
import { publicAuthorName } from "@/lib/testimonials";

const shown = (authorName: string, showFullName = false) => publicAuthorName({ authorName, showFullName });

describe("publicAuthorName", () => {
  it("shows first name + last initial by default", () => {
    expect(shown("Ahmad Saleh")).toBe("Ahmad S.");
    expect(shown("أحمد صالح")).toBe("أحمد ص.");
    // Middle names are never shown; the initial is the family name's.
    expect(shown("Ahmad Mohammad Ali Haddad")).toBe("Ahmad H.");
    expect(shown("  sara   khalil ")).toBe("sara K.");
  });

  it("shows the full name only when the reviewer opted in", () => {
    expect(shown("Ahmad Mohammad Haddad", true)).toBe("Ahmad Mohammad Haddad");
    expect(shown("  أحمد   صالح ", true)).toBe("أحمد صالح");
  });

  it("keeps a one-word name as it is", () => {
    expect(shown("Ahmad")).toBe("Ahmad");
    expect(shown("أحمد")).toBe("أحمد");
  });

  it("treats عبد / Abd + the next word as one first name", () => {
    expect(shown("عبد الله الخطيب")).toBe("عبد الله خ.");
    expect(shown("عبد الرحمن")).toBe("عبد الرحمن");
    expect(shown("Abd Allah Haddad")).toBe("Abd Allah H.");
  });

  it("skips the article for the initial", () => {
    expect(shown("محمد العلي")).toBe("محمد ع.");
    expect(shown("Omar Al-Khatib")).toBe("Omar K.");
    expect(shown("Omar El-Sayed")).toBe("Omar S.");
  });

  it("never shows a phone number, email or membership number", () => {
    expect(shown("Ahmad 0791234567")).toBe("Ahmad");
    expect(shown("Ahmad 079 123 4567", true)).toBe("Ahmad");
    expect(shown("ahmad@example.com Saleh", true)).toBe("Saleh");
    expect(shown("GG-00042")).toBe("");
    expect(shown("أحمد ٠٧٩١٢٣٤٥٦٧ صالح", true)).toBe("أحمد صالح");
  });

  it("returns an empty string when no name is left", () => {
    expect(shown("")).toBe("");
    expect(shown("   ")).toBe("");
  });
});

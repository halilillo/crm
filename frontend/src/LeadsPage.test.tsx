// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { api, Lead, StatusOption } from "./api";
import LeadsPage from "./LeadsPage";

const statuses: StatusOption[] = [
  { value: "new", label: "Новая" },
  { value: "won", label: "Успешно" },
];
const leads: Lead[] = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1,
  name: `Тест ${index + 1}`,
  phone: `+998 00 000-00-${String(index + 1).padStart(2, "0")}`,
  status: "new",
  created_at: `2026-10-${String(index + 1).padStart(2, "0")}T10:00:00Z`,
  updated_at: "",
}));

beforeEach(() => {
  window.history.replaceState(null, "", "/");
  vi.spyOn(api, "statuses").mockResolvedValue(statuses);
  vi.spyOn(api, "leads").mockResolvedValue(leads);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("состояние списка заявок в URL", () => {
  it("открывает первую страницу при page=-1", async () => {
    window.history.replaceState(null, "", "/?page=-1");

    render(<LeadsPage />);

    await screen.findByText("Страница 1 из 3");
    expect(screen.getByText("Тест 12")).toBeTruthy();
    expect((screen.getByRole("button", { name: "Назад" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByText("Не удалось загрузить заявки.")).toBeNull();
  });

  it("показывает все заявки при неизвестном status", async () => {
    window.history.replaceState(null, "", "/?status=unknown");

    render(<LeadsPage />);

    await screen.findByText("Страница 1 из 3");
    expect(screen.getByRole("button", { name: "Все" }).className).toContain("active");
    expect(api.leads).toHaveBeenCalledWith(undefined);
    expect(screen.getByText("Тест 12")).toBeTruthy();
    expect(screen.queryByText("Не удалось загрузить заявки.")).toBeNull();
  });

  it("использует сортировку по новым заявкам при неизвестном sort", async () => {
    window.history.replaceState(null, "", "/?sort=unknown");

    render(<LeadsPage />);

    await screen.findByText("Страница 1 из 3");
    expect((screen.getByLabelText("Сортировка") as HTMLSelectElement).value).toBe("newest");
    expect(screen.getAllByRole("row")[1].querySelector("td")?.textContent).toBe("Тест 12");
    expect(screen.queryByText("Не удалось загрузить заявки.")).toBeNull();
  });

  it("восстанавливает поиск, статус, сортировку и страницу после повторного открытия", async () => {
    window.history.replaceState(null, "", "/?q=%D0%A2%D0%B5%D1%81%D1%82&status=new&sort=oldest&page=2");

    const first = render(<LeadsPage />);
    await screen.findByText("Страница 2 из 3");
    expect((screen.getByLabelText("Поиск заявок") as HTMLInputElement).value).toBe("Тест");
    expect((screen.getByLabelText("Сортировка") as HTMLSelectElement).value).toBe("oldest");
    expect(screen.getByRole("button", { name: "Новая" }).className).toContain("active");
    expect(screen.getByText("Тест 6")).toBeTruthy();

    first.unmount();
    render(<LeadsPage />);
    await screen.findByText("Страница 2 из 3");
    expect((screen.getByLabelText("Поиск заявок") as HTMLInputElement).value).toBe("Тест");
    expect((screen.getByLabelText("Сортировка") as HTMLSelectElement).value).toBe("oldest");
    expect(screen.getByRole("button", { name: "Новая" }).className).toContain("active");
  });

  it("записывает изменения в URL и восстанавливает экран при Назад и Вперед", async () => {
    render(<LeadsPage />);
    await screen.findByText("Страница 1 из 3");

    fireEvent.change(screen.getByLabelText("Поиск заявок"), { target: { value: "Тест" } });
    fireEvent.change(screen.getByLabelText("Сортировка"), { target: { value: "oldest" } });
    fireEvent.click(screen.getByRole("button", { name: "Вперед" }));
    expect(window.location.search).toContain("q=%D0%A2%D0%B5%D1%81%D1%82");
    expect(window.location.search).toContain("sort=oldest");
    expect(window.location.search).toContain("page=2");
    expect(screen.getByText("Страница 2 из 3")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Новая" }));
    expect(window.location.search).toContain("status=new");
    expect(await screen.findByText("Страница 1 из 3")).toBeTruthy();

    window.history.back();
    await waitFor(() => expect(screen.getByText("Страница 2 из 3")).toBeTruthy());
    expect(screen.getByRole("button", { name: "Все" }).className).toContain("active");
    expect(window.location.search).not.toContain("status=new");

    window.history.back();
    await waitFor(() => expect(screen.getByText("Страница 1 из 3")).toBeTruthy());
    expect((screen.getByLabelText("Сортировка") as HTMLSelectElement).value).toBe("oldest");

    window.history.back();
    await waitFor(() => expect((screen.getByLabelText("Сортировка") as HTMLSelectElement).value).toBe("newest"));
    expect((screen.getByLabelText("Поиск заявок") as HTMLInputElement).value).toBe("Тест");

    window.history.back();
    await waitFor(() => expect((screen.getByLabelText("Поиск заявок") as HTMLInputElement).value).toBe(""));

    window.history.forward();
    await waitFor(() => expect((screen.getByLabelText("Поиск заявок") as HTMLInputElement).value).toBe("Тест"));
    window.history.forward();
    await waitFor(() => expect((screen.getByLabelText("Сортировка") as HTMLSelectElement).value).toBe("oldest"));
    window.history.forward();
    await waitFor(() => expect(screen.getByText("Страница 2 из 3")).toBeTruthy());
    window.history.forward();
    await waitFor(() => expect(screen.getByRole("button", { name: "Новая" }).className).toContain("active"));
    expect(screen.getByText("Страница 1 из 3")).toBeTruthy();
    expect(window.location.search).toContain("status=new");
  });
});

describe("загрузка списка заявок", () => {
  it("при ошибке показывает сообщение и повтор, но не пустое состояние", async () => {
    vi.mocked(api.leads).mockRejectedValueOnce(new Error("network error"));

    render(<LeadsPage />);

    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Не удалось загрузить заявки.");
    expect(screen.getByRole("button", { name: "Повторить" })).toBeTruthy();
    expect(screen.queryByText("Заявок нет.")).toBeNull();
    expect(screen.queryByText("Заявки не найдены")).toBeNull();
  });

  it("повторно загружает заявки без обновления страницы", async () => {
    vi.mocked(api.leads).mockRejectedValueOnce(new Error("network error"));

    render(<LeadsPage />);
    await screen.findByRole("button", { name: "Повторить" });
    fireEvent.click(screen.getByRole("button", { name: "Повторить" }));

    expect(await screen.findByText("Тест 12")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByText("Заявок нет.")).toBeNull();
    expect(api.leads).toHaveBeenCalledTimes(2);
  });

  it("показывает пустое состояние после успешной загрузки пустого списка", async () => {
    vi.mocked(api.leads).mockResolvedValue([]);

    render(<LeadsPage />);

    expect(await screen.findByText("Заявок нет.")).toBeTruthy();
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.queryByRole("button", { name: "Повторить" })).toBeNull();
  });
});

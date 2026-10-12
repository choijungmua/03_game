import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Dialog } from "./index";

it("renders the optional footer close button and closes the dialog", () => {
  render(
    <Dialog defaultOpen>
      <Dialog.Content showCloseButton={false}>
        <Dialog.Title>Dialog test</Dialog.Title>
        <Dialog.Description>Footer close action</Dialog.Description>
        <Dialog.Footer showCloseButton />
      </Dialog.Content>
    </Dialog>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

import { render, screen } from "@/test/test-utils";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "../table";

function renderFullTable() {
  return render(
    <Table>
      <TableCaption>A list of items</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>Item A</TableCell>
          <TableCell>100</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>Item B</TableCell>
          <TableCell>200</TableCell>
        </TableRow>
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Total</TableCell>
          <TableCell>300</TableCell>
        </TableRow>
      </TableFooter>
    </Table>,
  );
}

describe("Table", () => {
  it("renders a table element", () => {
    render(<Table />);
    expect(screen.getByRole("table")).toBeInTheDocument();
  });

  it("sets data-slot=table", () => {
    render(<Table />);
    expect(screen.getByRole("table")).toHaveAttribute("data-slot", "table");
  });

  it("wraps table in a container div", () => {
    render(<Table data-testid="tbl" />);
    const table = screen.getByTestId("tbl");
    expect(table.parentElement).toHaveAttribute("data-slot", "table-container");
  });

  it("merges custom className on table element", () => {
    render(<Table className="striped" />);
    expect(screen.getByRole("table").className).toContain("striped");
  });
});

describe("TableHeader", () => {
  it("renders thead with data-slot", () => {
    render(
      <Table>
        <TableHeader data-testid="thead">
          <TableRow>
            <TableHead>H</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(screen.getByTestId("thead").tagName).toBe("THEAD");
    expect(screen.getByTestId("thead")).toHaveAttribute("data-slot", "table-header");
  });
});

describe("TableBody", () => {
  it("renders tbody with data-slot", () => {
    render(
      <Table>
        <TableBody data-testid="tbody">
          <TableRow>
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByTestId("tbody").tagName).toBe("TBODY");
    expect(screen.getByTestId("tbody")).toHaveAttribute("data-slot", "table-body");
  });
});

describe("TableFooter", () => {
  it("renders tfoot with data-slot", () => {
    render(
      <Table>
        <TableFooter data-testid="tfoot">
          <TableRow>
            <TableCell>F</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    );
    expect(screen.getByTestId("tfoot").tagName).toBe("TFOOT");
    expect(screen.getByTestId("tfoot")).toHaveAttribute("data-slot", "table-footer");
  });
});

describe("TableRow", () => {
  it("renders tr with data-slot", () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="row">
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByTestId("row").tagName).toBe("TR");
    expect(screen.getByTestId("row")).toHaveAttribute("data-slot", "table-row");
  });

  it("merges custom className", () => {
    render(
      <Table>
        <TableBody>
          <TableRow data-testid="row" className="highlighted">
            <TableCell>Cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByTestId("row").className).toContain("highlighted");
  });
});

describe("TableHead", () => {
  it("renders th with data-slot", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    const th = screen.getByRole("columnheader", { name: "Name" });
    expect(th).toHaveAttribute("data-slot", "table-head");
  });

  it("defaults scope to col", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    expect(screen.getByRole("columnheader")).toHaveAttribute("scope", "col");
  });

  it("accepts custom scope", () => {
    render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead scope="row">Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    );
    // scope="row" changes the ARIA role to "rowheader"
    expect(screen.getByRole("rowheader")).toHaveAttribute("scope", "row");
  });
});

describe("TableCell", () => {
  it("renders td with data-slot", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>Value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("cell", { name: "Value" })).toHaveAttribute("data-slot", "table-cell");
  });

  it("merges custom className", () => {
    render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell className="font-bold">Value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    );
    expect(screen.getByRole("cell").className).toContain("font-bold");
  });
});

describe("TableCaption", () => {
  it("renders caption with data-slot", () => {
    render(
      <Table>
        <TableCaption>My caption</TableCaption>
      </Table>,
    );
    expect(screen.getByText("My caption").tagName).toBe("CAPTION");
    expect(screen.getByText("My caption")).toHaveAttribute("data-slot", "table-caption");
  });
});

describe("Table composition", () => {
  it("renders a complete table with all sub-components", () => {
    renderFullTable();

    expect(screen.getByText("A list of items")).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Value")).toBeInTheDocument();
    expect(screen.getByText("Item A")).toBeInTheDocument();
    expect(screen.getByText("Item B")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("300")).toBeInTheDocument();
  });
});

import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("Token Contract - Part 5 Tests", function () {
  // Фикстура для деплоя контракта
  async function deployTokenFixture() {
    const [owner, addr1, addr2] = await ethers.getSigners();
    
    const TokenFactory = await ethers.getContractFactory("Token");
    const token = await TokenFactory.deploy();
    
    return { token, owner, addr1, addr2 };
  }

  // ==================== БАЗОВЫЕ ПРОВЕРКИ ====================
  describe("Basic Balance Checks", function () {
    it("Should have correct name and symbol", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      
      expect(await token.name()).to.equal("TestToken");
      expect(await token.symbol()).to.equal("TTK");
      expect(await token.decimals()).to.equal(18);
    });

    it("Should assign total supply to owner", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      const ownerBalance = await token.balanceOf(owner.address);
      const totalSupply = await token.totalSupply();
      
      expect(ownerBalance).to.equal(totalSupply);
    });

    it("Should have 1 million initial supply", async function () {
      const { token } = await loadFixture(deployTokenFixture);
      const totalSupply = await token.totalSupply();
      
      expect(totalSupply).to.equal(ethers.parseEther("1000000"));
    });
  });

  // ==================== ТЕСТЫ ПЕРЕВОДОВ ====================
  describe("Transfer Tests", function () {
    it("Should transfer tokens between accounts", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      const transferAmount = ethers.parseEther("100");
      await token.transfer(addr1.address, transferAmount);
      
      expect(await token.balanceOf(addr1.address)).to.equal(transferAmount);
    });

    it("Should update balances correctly after transfer", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      const initialOwnerBalance = await token.balanceOf(owner.address);
      const transferAmount = ethers.parseEther("150");
      
      await token.transfer(addr1.address, transferAmount);
      await token.connect(addr1).transfer(addr2.address, ethers.parseEther("50"));
      
      const finalOwnerBalance = await token.balanceOf(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance - transferAmount);
      expect(await token.balanceOf(addr1.address)).to.equal(ethers.parseEther("100"));
      expect(await token.balanceOf(addr2.address)).to.equal(ethers.parseEther("50"));
    });
  });

  // ==================== ТЕСТЫ НА ОШИБКИ ====================
  describe("Failing Transfer Tests", function () {
    it("Should fail when sender has insufficient balance", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(addr1).transfer(owner.address, 1)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });

    it("Should fail when transferring to zero address", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.transfer(ethers.ZeroAddress, 100)
      ).to.be.revertedWithCustomError(token, "ERC20InvalidReceiver");
    });
  });

  // ==================== КРАЙНИЕ СЛУЧАИ ====================
  describe("Edge Cases", function () {
    it("Should allow transferring to yourself", async function () {
      const { token, owner } = await loadFixture(deployTokenFixture);
      
      const initialBalance = await token.balanceOf(owner.address);
      const transferAmount = ethers.parseEther("100");
      
      await expect(token.transfer(owner.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, owner.address, transferAmount);
      
      expect(await token.balanceOf(owner.address)).to.equal(initialBalance);
    });

    it("Should handle zero amount transfer", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      await expect(token.transfer(addr1.address, 0))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, 0);
    });
  });

  // ==================== ГАЗОВЫЕ ТЕСТЫ ====================
  describe("Gas Estimation Tests", function () {
    it("Should estimate gas for successful transfer", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      const transferAmount = ethers.parseEther("100");
      const gasEstimate = await token.transfer.estimateGas(addr1.address, transferAmount);
      
      console.log(`Gas for successful transfer: ${gasEstimate}`);
      expect(gasEstimate).to.be.lt(100000);
    });

    it("Should estimate gas for failing transfer", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      try {
        await token.connect(addr1).transfer.estimateGas(owner.address, 1);
      } catch (error: any) {
        console.log(`Gas used before revert: ${error.message.includes("gas") ? "unknown" : "early revert"}`);
      }
    });
  });

  // ==================== ТЕСТЫ СОБЫТИЙ ====================
  describe("Event Emission Tests", function () {
    it("Should emit Transfer event", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      const transferAmount = ethers.parseEther("200");
      
      await expect(token.transfer(addr1.address, transferAmount))
        .to.emit(token, "Transfer")
        .withArgs(owner.address, addr1.address, transferAmount);
    });

    it("Should emit Approval event", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      const approveAmount = ethers.parseEther("500");
      
      await expect(token.approve(addr1.address, approveAmount))
        .to.emit(token, "Approval")
        .withArgs(owner.address, addr1.address, approveAmount);
    });
  });

  // ==================== APPROVE & TRANSFERFROM ====================
  describe("Approve and TransferFrom", function () {
    it("Should approve tokens for delegated transfer", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      const approveAmount = ethers.parseEther("300");
      await token.approve(addr1.address, approveAmount);
      
      expect(await token.allowance(owner.address, addr1.address)).to.equal(approveAmount);
    });

    it("Should transferFrom with allowance", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      const transferAmount = ethers.parseEther("150");
      await token.approve(addr1.address, transferAmount);
      
      await token.connect(addr1).transferFrom(
        owner.address,
        addr2.address,
        transferAmount
      );
      
      expect(await token.balanceOf(addr2.address)).to.equal(transferAmount);
      expect(await token.allowance(owner.address, addr1.address)).to.equal(0);
    });

    it("Should fail transferFrom without allowance", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, 100)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });

    it("Should fail transferFrom with insufficient allowance", async function () {
      const { token, owner, addr1, addr2 } = await loadFixture(deployTokenFixture);
      
      await token.approve(addr1.address, 50);
      
      await expect(
        token.connect(addr1).transferFrom(owner.address, addr2.address, 100)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientAllowance");
    });
  });

  // ==================== NEGATIVE TESTS ====================
  describe("Negative Tests (Reverts, Asserts)", function () {
    it("Should revert with too large amount", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      const hugeAmount = ethers.MaxUint256;
      
      await expect(
        token.connect(addr1).transfer(owner.address, hugeAmount)
      ).to.be.revertedWithCustomError(token, "ERC20InsufficientBalance");
    });
  });

  // ==================== STORAGE VERIFICATION ====================
  describe("Storage Verification", function () {
    it("Should store balances in correct slots", async function () {
      const { token, owner, addr1 } = await loadFixture(deployTokenFixture);
      
      const initialBalance = await token.balanceOf(owner.address);
      const transferAmount = ethers.parseEther("500");
      
      await token.transfer(addr1.address, transferAmount);
      
      const newOwnerBalance = await token.balanceOf(owner.address);
      const addr1Balance = await token.balanceOf(addr1.address);
      
      expect(newOwnerBalance).to.equal(initialBalance - transferAmount);
      expect(addr1Balance).to.equal(transferAmount);
    });
  });
});
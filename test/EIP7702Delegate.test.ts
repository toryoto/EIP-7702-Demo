import { expect } from "chai";
import { ethers } from "hardhat";
import { Contract } from "ethers";

describe("MinimalEIP7702Delegate", function () {
  let delegate: any;
  let mockTarget: any;
  let owner: any;
  let unauthorized: any;
  let addr1: any;
  let addr2: any;

  beforeEach(async function () {
    // アカウントを取得
    [owner, unauthorized, addr1, addr2] = await ethers.getSigners();

    // Delegateコントラクトをデプロイ
    const MinimalEIP7702DelegateFactory = await ethers.getContractFactory("MinimalEIP7702Delegate");
    delegate = await MinimalEIP7702DelegateFactory.deploy();

    // テスト用のモックターゲットコントラクトをデプロイ
    const MockTargetFactory = await ethers.getContractFactory("MockTarget");
    mockTarget = await MockTargetFactory.deploy();
  });

  describe("基本機能", function () {
    it("コントラクトが正常にデプロイされる", async function () {
      expect(await delegate.getAddress()).to.be.properAddress;
    });

    it("初期残高が0である", async function () {
      expect(await delegate.getBalance()).to.equal(0n);
    });
  });

  describe("認証", function () {
    it("委譲されたEOA自身からの呼び出しは許可される", async function () {
      // EIP-7702では委譲されたEOA自身（address(this)）が呼び出し元になる
      // テストでは直接コントラクトを呼び出す
      await expect(
        delegate.execute(await mockTarget.getAddress(), 0, "0x")
      ).to.not.be.reverted;
    });

    it("未認証のアドレスからの呼び出しは拒否される", async function () {
      // 別のアドレスから呼び出そうとする
      await expect(
        delegate.connect(unauthorized).execute(await mockTarget.getAddress(), 0, "0x")
      ).to.be.revertedWith("MinimalDelegate: not authorized");
    });
  });

  describe("単一実行", function () {
    it("正常な呼び出しを実行できる", async function () {
      const data = mockTarget.interface.encodeFunctionData("setValue", [42]);
      
      await expect(
        delegate.execute(await mockTarget.getAddress(), 0, data)
      ).to.emit(delegate, "CallExecuted")
        .withArgs(await mockTarget.getAddress(), 0, data, true);

      expect(await mockTarget.value()).to.equal(42);
    });

    it("ETHを送信して呼び出しを実行できる", async function () {
      const sendAmount = ethers.parseEther("1.0");
      
      // まずETHを送信
      await owner.sendTransaction({
        to: await delegate.getAddress(),
        value: sendAmount
      });

      const data = mockTarget.interface.encodeFunctionData("receiveEth");
      
      await expect(
        delegate.execute(await mockTarget.getAddress(), sendAmount, data)
      ).to.emit(delegate, "CallExecuted")
        .withArgs(await mockTarget.getAddress(), sendAmount, data, true);

      const targetAddress = await mockTarget.getAddress();
      expect(await ethers.provider.getBalance(targetAddress)).to.equal(sendAmount);
    });

    it("無効なターゲットアドレスでエラーになる", async function () {
      await expect(
        delegate.execute(ethers.ZeroAddress, 0, "0x")
      ).to.be.revertedWith("MinimalDelegate: invalid target");
    });

    it("存在しない関数の呼び出しでエラーになる", async function () {
      const invalidData = "0x12345678";
      
      await expect(
        delegate.execute(await mockTarget.getAddress(), 0, invalidData)
      ).to.be.revertedWith("Call failed");
    });
  });

  describe("バッチ実行", function () {
    it("複数の正常な呼び出しをバッチ実行できる", async function () {
      const calls = [
        {
          target: await mockTarget.getAddress(),
          value: 0,
          data: mockTarget.interface.encodeFunctionData("setValue", [10])
        },
        {
          target: await mockTarget.getAddress(),
          value: 0,
          data: mockTarget.interface.encodeFunctionData("setValue", [20])
        }
      ];

      await expect(
        delegate.executeBatch(calls)
      ).to.emit(delegate, "BatchExecuted")
        .withArgs(2, 2);

      expect(await mockTarget.value()).to.equal(20); // 最後の値
    });

    it("バッチ内の無効なターゲットでエラーになる", async function () {
      const calls = [
        {
          target: await mockTarget.getAddress(),
          value: 0,
          data: mockTarget.interface.encodeFunctionData("setValue", [10])
        },
        {
          target: ethers.ZeroAddress,
          value: 0,
          data: "0x"
        }
      ];

      await expect(
        delegate.executeBatch(calls)
      ).to.be.revertedWith("MinimalDelegate: invalid target");
    });

    it("バッチ内の失敗した呼び出しでエラーになる", async function () {
      const calls = [
        {
          target: await mockTarget.getAddress(),
          value: 0,
          data: mockTarget.interface.encodeFunctionData("setValue", [10])
        },
        {
          target: await mockTarget.getAddress(),
          value: 0,
          data: "0x12345678" // 無効なデータ
        }
      ];

      await expect(
        delegate.executeBatch(calls)
      ).to.be.revertedWith("Call failed");
    });
  });

  describe("残高確認", function () {
    it("ETH残高を正しく取得できる", async function () {
      const amount = ethers.parseEther("5.0");
      
      await owner.sendTransaction({
        to: await delegate.getAddress(),
        value: amount
      });

      expect(await delegate.getBalance()).to.equal(amount);
    });

    it("ERC20トークン残高を正しく取得できる", async function () {
      // モックERC20トークンをデプロイ
      const MockERC20Factory = await ethers.getContractFactory("MockERC20");
      const mockToken: any = await MockERC20Factory.deploy("Mock Token", "MTK");

      // トークンをミント
      await mockToken.mint(await delegate.getAddress(), 1000);

      expect(await delegate.getTokenBalance(await mockToken.getAddress())).to.equal(1000);
    });

    it("存在しないERC20トークンで残高取得が失敗する", async function () {
      expect(await delegate.getTokenBalance(addr1.address)).to.equal(0);
    });
  });

  describe("ETH受信", function () {
    it("receive関数でETHを受信できる", async function () {
      const amount = ethers.parseEther("1.0");
      
      await owner.sendTransaction({
        to: await delegate.getAddress(),
        value: amount
      });

      expect(await delegate.getBalance()).to.equal(amount);
    });

    it("fallback関数でETHを受信できる", async function () {
      const amount = ethers.parseEther("1.0");
      
      await owner.sendTransaction({
        to: await delegate.getAddress(),
        value: amount,
        data: "0x12345678" // 無効なデータ
      });

      expect(await delegate.getBalance()).to.equal(amount);
    });
  });
});

// テスト用のモックコントラクト
describe("MockTarget", function () {
  let mockTarget: any;

  beforeEach(async function () {
    const MockTargetFactory = await ethers.getContractFactory("MockTarget");
    mockTarget = await MockTargetFactory.deploy();
  });

  it("値の設定と取得ができる", async function () {
    await mockTarget.setValue(42);
    expect(await mockTarget.value()).to.equal(42);
  });

  it("ETHを受信できる", async function () {
    const [owner] = await ethers.getSigners();
    const amount = ethers.parseEther("1.0");
    
    await owner.sendTransaction({
      to: await mockTarget.getAddress(),
      value: amount
    });

    expect(await ethers.provider.getBalance(await mockTarget.getAddress())).to.equal(amount);
  });
}); 
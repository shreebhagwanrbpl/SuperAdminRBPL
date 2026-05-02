"use client";


export default function ProductPage() {


  return (
    <div className="flex">

   

      <div className="main">

        {/* TOP BAR */}
        <div className="topbar">
          <h1 className="text-3xl font-bold text-gray-800">
            Product Page
          </h1>


        </div>

      </div>
      <style jsx>{`
  .main {
    margin-left: 260px;
    padding: 30px;
    min-height: 100vh;
    background: #f5f7fb;
  }

  .topbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 30px;
  }

  .card-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
  }

  .card {
    background: #fff;
    padding: 20px;
    border-radius: 16px;
    box-shadow: 0 8px 25px rgba(0,0,0,0.05);
    transition: 0.3s;
  }

  .card:hover {
    transform: translateY(-4px);
    box-shadow: 0 12px 30px rgba(0,0,0,0.08);
  }

  .card-title {
    color: #6b7280;
    font-size: 14px;
  }

  .card-value {
    font-size: 28px;
    font-weight: 700;
    margin-top: 5px;
  }

  .empty-box {
    background: #fff;
    padding: 25px;
    border-radius: 16px;
    text-align: center;
    box-shadow: 0 8px 25px rgba(0,0,0,0.05);
    color: #6b7280;
  }
`}</style>
    </div>
  );
}
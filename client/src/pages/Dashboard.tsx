import { useEffect, useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Moon, Sun, SunMoon } from "lucide-react";
import { useTheme } from "../components/ThemeProvider";
import ArticleInput from "../components/ArticleInput";
import ConversionStatus from "../components/ConversionStatus";
import AudioPlayerOverlay from "../components/AudioPlayerOverlay";
import { getArticles } from "../lib/api";
import type { Article } from "../../../db/schema";

export default function Dashboard() {
  const { data: articles, mutate } = useSWR("/api/articles", getArticles);
  const [selectedArticle, setSelectedArticle] = useState<Article | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      mutate();
    }, 5000);
    return () => clearInterval(interval);
  }, [mutate]);

  const { theme, setTheme } = useTheme();

  const toggleTheme = () => {
    setTheme(
      theme === "light" ? "dark" : theme === "dark" ? "system" : "light",
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-background/95">
      <div className="mx-auto max-w-[700px] p-6 pb-24">
        <div className="flex justify-between items-center mb-8">
           
          <svg 
            xmlns="http://www.w3.org/2000/svg"
            width="140"
            height="56"
            className="text-foreground fill-current"
            viewBox="0 0 136 50"
            version="1.2"
          >
              <path d="M6.25702 35.294C7.6403 35.6157 9.31309 35.7766 11.2754 35.7766C14.1063 35.7766 16.5672 35.2779 18.6582 34.2807C20.7653 33.2674 22.3979 31.9726 23.556 30.3963C24.7301 28.82 25.3172 27.1794 25.3172 25.4744C25.3172 24.3163 24.899 23.2467 24.0626 22.2656C23.2262 21.2683 22.1164 20.255 20.7331 19.2256L15.0874 15.0516C14.042 14.2795 13.2297 13.604 12.6507 13.025C12.0877 12.4459 11.8062 11.8106 11.8062 11.119C11.8062 10.3791 12.152 9.63113 12.8436 8.87513C13.5514 8.11917 14.5003 7.4195 15.6906 6.77611C16.8165 6.16489 17.9987 5.68234 19.2373 5.32851C20.4758 4.97464 21.5936 4.79771 22.5909 4.79771C22.9448 4.79771 23.2423 4.854 23.4836 4.96661C23.7409 5.07919 23.8696 5.32044 23.8696 5.69041C23.8696 6.07644 23.6846 6.47853 23.3147 6.89676C22.9608 7.29885 22.5507 7.62056 22.0842 7.86181C21.4891 8.18353 21.0548 8.56956 20.7814 9.0199C20.524 9.47029 20.3953 9.92064 20.3953 10.371C20.3953 10.9018 20.5562 11.3682 20.8779 11.7704C21.1996 12.1564 21.6339 12.3494 22.1807 12.3494C22.7115 12.3494 23.2906 12.1323 23.9179 11.698C26.7166 9.81609 28.1159 7.64469 28.1159 5.18374C28.1159 3.52703 27.5852 2.32873 26.5236 1.58884C25.4781 0.84895 24.1672 0.479004 22.5909 0.479004C21.0628 0.479004 19.3981 0.784612 17.5966 1.39582C15.7952 1.99095 14.0983 2.81126 12.5059 3.85676C10.9135 4.91835 9.61064 6.1247 8.59732 7.47578C7.58401 8.81081 7.07734 10.2021 7.07734 11.6497C7.07734 12.7113 7.37492 13.7327 7.97004 14.7138C8.56516 15.695 9.4659 16.7164 10.6722 17.7779L12.4576 19.1773C12.9241 19.5472 13.5031 19.9735 14.1948 20.456C14.9025 20.9386 15.7228 21.4854 16.6557 22.0966C17.7012 22.7722 18.4652 23.4236 18.9477 24.0509C19.4303 24.6782 19.6715 25.2814 19.6715 25.8604C19.6715 26.8898 19.2936 27.8147 18.5376 28.635C17.7816 29.4392 16.7763 30.0746 15.5217 30.541C14.2832 31.0075 12.9241 31.2407 11.4443 31.2407C9.30506 31.2407 7.76095 30.9914 6.81195 30.4928C5.87902 29.9781 5.41257 29.3829 5.41257 28.7074C5.41257 28.1766 5.66992 27.6458 6.18463 27.115C6.69934 26.5682 7.40708 26.1017 8.30781 25.7157C9.11203 25.3779 9.62674 25.0803 9.85193 24.823C10.0771 24.5495 10.1897 24.1796 10.1897 23.7132C10.1897 23.2306 10.0771 22.8044 9.85193 22.4344C9.64284 22.0484 9.30506 21.8554 8.83858 21.8554C7.58401 22.161 6.43395 22.6033 5.38844 23.1823C4.35903 23.7614 3.46635 24.4209 2.71038 25.1607C1.13409 26.7049 0.345947 28.3053 0.345947 29.962C0.345947 30.7341 0.547002 31.474 0.949119 32.1817C1.35123 32.8733 1.99461 33.4845 2.87927 34.0153C3.76391 34.5622 4.88984 34.9884 6.25702 35.294Z" />
              <path fill-rule="evenodd" clip-rule="evenodd" d="M18.7031 47.1888C19.073 47.4301 19.5475 47.5507 20.1266 47.5507C21.0273 47.5507 21.7592 47.237 22.3221 46.6094C22.8851 45.9984 23.3193 45.2827 23.625 44.4625C23.6893 44.2694 23.8743 43.8111 24.1799 43.0872C24.5016 42.3794 24.8876 41.5348 25.338 40.5538C25.7883 39.5566 26.1663 38.704 26.4719 37.9963C26.7936 37.2886 27.0108 36.8302 27.1233 36.6211C27.2199 36.4442 27.3968 36.0984 27.6542 35.5836C27.9276 35.0689 28.2493 34.4658 28.6192 33.7741L30.2598 30.71C30.7584 29.8415 31.3858 28.9005 32.1417 27.8872C32.8977 26.8739 33.7663 25.9008 34.7474 24.9679C35.6964 24.0349 36.6856 23.2709 37.715 22.6758C38.7606 22.0807 39.7579 21.7831 40.7066 21.7831C41.3984 21.7831 41.7442 21.9922 41.7442 22.4104C41.7442 22.8929 41.3341 23.5846 40.5139 24.4853C39.6932 25.386 38.7845 26.335 37.7874 27.3323C36.758 28.3617 35.809 29.3911 34.9405 30.4205C34.088 31.4338 33.6135 32.2943 33.5169 33.0021L33.4928 33.1951V33.3881C33.4928 34.1763 33.8226 34.7955 34.482 35.2459C35.1576 35.6963 36.1066 35.9214 37.329 35.9214C38.6317 35.9214 39.8542 35.7123 40.9965 35.2941C42.1383 34.8759 43.3127 34.2808 44.5187 33.5088C45.6931 32.7689 46.9638 31.8601 48.3308 30.7824C48.9548 30.2875 49.606 29.7798 50.2845 29.2592C50.3052 30.3877 50.5381 31.4504 50.983 32.4472C51.4655 33.4766 52.1569 34.313 53.0578 34.9564C53.9744 35.5837 55.0763 35.8973 56.3631 35.8973C58.0196 35.8973 59.7169 35.5837 61.4537 34.9564C63.191 34.3291 64.7672 33.6214 66.1828 32.8332C67.0436 32.343 67.8645 31.8395 68.6454 31.3226C68.6827 32.3961 68.9629 33.2616 69.4856 33.9189C70.0646 34.6266 70.7321 35.1333 71.4881 35.4389C72.2441 35.7445 72.8955 35.8973 73.4423 35.8973C74.5359 35.8973 75.6057 35.5837 76.6512 34.9564C77.6966 34.313 78.6696 33.5248 79.5706 32.5919C80.4711 31.6429 81.2514 30.7261 81.9111 29.8415C81.7019 30.4044 81.5973 31.0478 81.5973 31.7716C81.5973 32.7689 81.8546 33.7098 82.3694 34.5945C82.8841 35.463 83.7043 35.8973 84.8301 35.8973C85.731 35.8973 86.7443 35.5917 87.8701 34.9805C88.9963 34.3532 90.0899 33.6052 91.1515 32.7367C91.855 32.1568 92.4685 31.6303 92.9922 31.1572C93.3829 32.795 94.2645 33.9971 95.6373 34.7634C97.0208 35.5194 98.5567 35.8973 100.246 35.8973C101.726 35.8973 103.149 35.6641 104.516 35.1977C105.899 34.7312 107.033 34.0637 107.918 33.1951C108.819 32.3105 109.269 31.2489 109.269 30.0104C109.269 28.5467 108.706 27.0509 107.58 25.5228C106.454 23.9787 104.935 22.708 103.02 21.7108C103.471 21.3569 103.905 20.987 104.323 20.6009C104.741 20.1988 104.951 19.7726 104.951 19.3222C104.951 18.9844 104.717 18.6467 104.251 18.3089C103.801 17.955 103.221 17.7781 102.514 17.7781C101.549 17.7781 100.664 18.1078 99.8595 18.7673C99.0554 19.4267 98.3961 20.1023 97.8814 20.794C97.7847 20.9065 97.7365 21.0593 97.7365 21.2523C97.7365 21.4936 97.8168 21.7349 97.9778 21.9761C98.1388 22.2013 98.2594 22.3381 98.3397 22.3863C99.3049 22.9815 100.262 23.6329 101.211 24.3406C102.176 25.0322 102.972 25.8123 103.599 26.6809C104.243 27.5495 104.564 28.5467 104.564 29.6726C104.564 30.5894 104.17 31.2489 103.382 31.651C102.61 32.0531 101.701 32.2542 100.656 32.2542C99.6747 32.2542 98.6695 32.029 97.6401 31.5787C96.6268 31.1122 95.9111 30.501 95.4928 29.745C95.38 29.5198 95.2111 29.3751 94.9859 29.3107C94.9658 29.3045 94.9458 29.2986 94.9259 29.293C95.2644 28.9666 95.5987 28.6508 95.9288 28.3456C96.2343 28.04 96.3871 27.662 96.3871 27.2116C96.3871 26.8256 96.2742 26.4798 96.049 26.1742C95.8402 25.8525 95.5746 25.6917 95.2531 25.6917C95.0118 25.6917 94.7622 25.7962 94.5049 26.0053C94.0066 26.52 93.5158 27.0106 93.0332 27.477C92.5506 27.9274 92.0845 28.3536 91.6341 28.7558C90.7978 29.4957 89.9854 30.139 89.1972 30.6859C88.4091 31.2167 87.7816 31.4821 87.3155 31.4821C86.9292 31.4821 86.6558 31.3293 86.4948 31.0237C86.3342 30.702 86.2535 30.2999 86.2535 29.8173C86.2535 29.2544 86.3663 28.5386 86.5916 27.6701C86.8329 26.8015 87.1223 25.9008 87.46 24.9679C87.7976 24.0028 88.1114 23.1262 88.4009 22.338C88.7064 21.5499 88.9156 20.9306 89.0284 20.4802C89.0445 20.432 89.0523 20.3435 89.0523 20.2149C89.0523 19.8127 88.8596 19.4428 88.4734 19.105C88.0875 18.7673 87.5889 18.5984 86.9774 18.5984C86.7843 18.5984 86.5512 18.6466 86.2778 18.7431C86.0205 18.8235 85.7713 18.9201 85.5301 19.0326L84.6855 19.4428C84.5245 19.282 84.3479 19.1372 84.1548 19.0085C83.9777 18.8638 83.7846 18.727 83.5758 18.5984C83.2056 18.3893 82.7552 18.1963 82.2244 18.0193C81.6936 17.8424 81.0743 17.7539 80.3669 17.7539C78.3884 17.7539 76.6433 18.2445 75.1314 19.2257C73.6354 20.2068 72.4051 21.4373 71.4399 22.9171C70.4747 24.3647 69.7669 25.8364 69.3168 27.3323C69.2917 27.4156 69.2674 27.4981 69.2437 27.5798C69.0161 27.7122 68.7356 27.879 68.4023 28.0803C67.5499 28.595 66.5287 29.1418 65.3383 29.7209C64.1479 30.316 62.9093 30.8468 61.6225 31.3132C60.3358 31.7636 59.1376 31.9888 58.0278 31.9888C56.5961 31.9888 55.792 31.4902 55.6153 30.4929C57.8026 29.6887 59.6201 28.8925 61.0679 28.1044C62.5317 27.3001 63.6978 26.512 64.5663 25.74C65.4347 24.984 66.0461 24.236 66.3998 23.4962C66.7535 22.7563 66.9306 22.0485 66.9306 21.373C66.9306 20.231 66.6008 19.3383 65.9416 18.6949C65.2819 18.0515 64.2846 17.7299 62.9497 17.7299C61.1 17.7299 59.3871 18.1239 57.8108 18.912C56.2507 19.6841 54.9075 20.6653 53.7817 21.8555C53.1649 22.5074 52.6255 23.1762 52.1632 23.8618C52.1095 23.8909 52.0544 23.9218 51.998 23.9545C48.3148 26.7211 45.4678 28.804 43.4572 30.2034C41.4465 31.5866 40.1198 32.2783 39.4762 32.2783C38.8491 32.2783 38.5354 32.0611 38.5354 31.6269C38.5514 31.4821 38.7684 31.1926 39.1868 30.7583C39.6212 30.324 40.152 29.8093 40.7791 29.2142C41.4066 28.603 42.0259 27.9757 42.637 27.3323C43.6824 26.2385 44.6072 25.1126 45.4114 23.9545C46.2317 22.7804 46.6418 21.7187 46.6418 20.7698C46.6418 19.7725 46.1757 19.0246 45.2426 18.526C44.3256 18.0113 43.3365 17.7539 42.275 17.7539C41.2617 17.7539 40.2322 17.9872 39.1868 18.4536C38.1574 18.904 37.1681 19.483 36.2191 20.1907C35.2702 20.8824 34.4016 21.5901 33.6135 22.3139C33.7261 22.1048 33.8306 21.7268 33.9271 21.18C34.0397 20.617 34.096 20.247 34.096 20.0701C34.096 19.0889 33.4848 18.5984 32.2624 18.5984C31.8441 18.5984 31.4501 18.7914 31.0802 19.1774C30.7102 19.5634 30.3724 20.0299 30.0668 20.5768C29.7612 21.1236 29.5038 21.6544 29.2947 22.1691C29.0857 22.6677 28.9248 23.0457 28.8122 23.3031C28.1849 25.185 27.3485 27.1714 26.303 29.2624C25.2736 31.3534 24.1638 33.4766 22.9735 35.6319C21.7833 37.8033 20.6252 39.9265 19.4993 42.0014C19.258 42.5321 18.9685 43.1514 18.6307 43.8593C18.2929 44.5671 18.124 45.2346 18.124 45.8617C18.124 46.5213 18.3171 46.9635 18.7031 47.1888ZM55.2534 27.7184C56.2988 27.1715 57.3604 26.5361 58.438 25.8123C59.5316 25.0724 60.3601 24.5336 60.923 24.1958C61.679 23.7133 62.1776 23.287 62.4189 22.9171C62.6923 22.515 62.829 22.1772 62.829 21.9038C62.829 21.6625 62.7487 21.4695 62.5877 21.3247C62.4432 21.18 62.2744 21.0915 62.0813 21.0593L61.8638 21.0352H61.6468C60.7624 21.0352 59.9417 21.2926 59.1861 21.8073C58.4462 22.3059 57.8187 22.9332 57.304 23.6892C56.7571 24.4773 56.3149 25.2172 55.9773 25.9088C55.6553 26.6005 55.414 27.2037 55.2534 27.7184ZM77.3026 30.6618C76.5305 31.3213 75.8874 31.651 75.3726 31.651C74.4878 31.651 73.9249 31.3132 73.6836 30.6377C73.4584 29.9621 73.3459 29.3107 73.3459 28.6834C73.3459 27.6057 73.6272 26.5683 74.1905 25.571C74.7533 24.5577 75.4772 23.7294 76.3617 23.086C77.2622 22.4426 78.2113 22.1209 79.2086 22.1209C79.7715 22.1209 80.4069 22.3058 81.1147 22.6758C81.8225 23.0296 82.1762 23.5122 82.1762 24.1234C82.1762 24.3969 81.9432 24.9276 81.4766 25.7158C81.0101 26.5039 80.3748 27.3805 79.5706 28.3456C78.8467 29.2302 78.0907 30.0023 77.3026 30.6618Z"  />
              <path d="M113.779 48.95C114.181 49.3844 114.704 49.6014 115.347 49.6014C116.907 49.6014 118.339 48.2504 119.642 45.548C119.786 45.2746 120.164 44.4305 120.776 43.0148C121.403 41.5992 122.07 39.9668 122.778 38.1171C123.438 37.5058 124.089 36.9509 124.732 36.4523C125.392 35.9537 126.108 35.4792 126.88 35.0288L128.593 34.0637C129.204 33.726 129.96 33.3158 130.861 32.8333C131.777 32.3508 132.742 31.828 133.756 31.265C134.544 30.8308 135.091 30.3804 135.397 29.9139C135.718 29.4475 135.879 29.0052 135.879 28.5869C135.879 28.1205 135.726 27.7345 135.42 27.4289C135.115 27.1232 134.761 26.9705 134.359 26.9705C134.279 26.9705 133.908 27.1072 133.249 27.3806C132.59 27.6379 131.785 27.9918 130.836 28.4422C129.888 28.8925 128.914 29.3992 127.917 29.9622C126.92 30.5091 126.035 31.072 125.263 31.651L130.667 20.3838C130.748 20.1747 130.788 19.9656 130.788 19.7565C130.788 19.4831 130.716 19.2258 130.571 18.9845C130.426 18.7271 130.185 18.5984 129.847 18.5984C129.429 18.5984 129.003 18.6708 128.569 18.8156C128.134 18.9603 127.515 19.3544 126.711 19.9978L116.747 29.7933C116.505 30.0185 116.248 30.2195 115.974 30.3965C115.701 30.5734 115.476 30.6619 115.299 30.6619C115.106 30.6619 115.009 30.5412 115.009 30.3C115.009 30.0426 115.122 29.6727 115.347 29.1901L119.762 19.9978C119.827 19.8691 119.859 19.7002 119.859 19.4911C119.859 19.1051 119.682 18.7995 119.328 18.5743C118.99 18.333 118.572 18.2124 118.073 18.2124C117.591 18.2124 117.092 18.3572 116.577 18.6467C116.063 18.9201 115.645 19.3705 115.323 19.9978C114.679 21.6384 114.092 23.0458 113.562 24.22C113.031 25.3942 112.564 26.3834 112.162 27.1876C111.776 27.9436 111.398 28.6674 111.028 29.359C110.674 30.0346 110.337 30.7664 110.015 31.5546C109.629 32.5679 109.436 33.4766 109.436 34.2809C109.436 34.8599 109.629 35.2701 110.015 35.5113C110.401 35.7687 110.867 35.8974 111.414 35.8974C113.119 35.8974 114.953 35.1414 116.915 33.6295C118.877 32.1175 121.065 29.93 123.478 27.0669L118.652 36.8383C117.591 38.1734 116.706 39.3314 115.998 40.3126C115.307 41.3098 114.752 42.2106 114.334 43.0148C113.899 43.819 113.594 44.5507 113.417 45.2103C113.256 45.886 113.176 46.5613 113.176 47.237C113.176 47.9609 113.377 48.5316 113.779 48.95Z"   />

          </svg>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="relative"
          >
            {theme === "light" && <Sun className="h-5 w-5 text-foreground" />}
            {theme === "dark" && <Moon className="h-5 w-5 text-foreground" />}
            {theme === "system" && <SunMoon className="h-5 w-5 text-foreground" />}
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <div>
            <ArticleInput onConvert={() => mutate()} />
            <h2 className="text-xl font-semibold mb-4 mt-12 text-foreground">
              Recent Conversions
            </h2>

            {articles?.map((article) => (
              <Card key={article.id} className="mt-6">
                <ConversionStatus
                  article={article}
                  onDelete={() => mutate()}
                  isSelected={selectedArticle?.id === article.id}
                  onSelect={() => {
                    if (article.status === "completed" && article.audioUrl) {
                      setSelectedArticle(article);
                    }
                  }}
                />
              </Card>
            ))}
          </div>
        </div>
      </div>

      {selectedArticle && selectedArticle.audioUrl && (
        <AudioPlayerOverlay
          title={selectedArticle.title}
          content={selectedArticle.content}
          audioUrl={selectedArticle.audioUrl}
        />
      )}
    </div>
  );
}

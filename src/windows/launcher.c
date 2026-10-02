#define UNICODE
#define _UNICODE
#include <windows.h>
#include <shellapi.h>

/* Opens only the canonical HTTPS workbook. No user-supplied URL or shell command. */
int WINAPI wWinMain(HINSTANCE instance,HINSTANCE previous,PWSTR args,int show) {
    (void)instance;(void)previous;(void)args;(void)show;
    HINSTANCE result=ShellExecuteW(NULL,L"open",L"https://horizons-tr.com/learn/",NULL,NULL,SW_SHOWNORMAL);
    if((INT_PTR)result<=32){
        MessageBoxW(NULL,L"Please open https://horizons-tr.com/learn/ in your browser.\n\nSet a default browser in Windows Settings if needed.",L"HORIZONS Arabic",MB_OK|MB_ICONINFORMATION);
        return 1;
    }
    return 0;
}
